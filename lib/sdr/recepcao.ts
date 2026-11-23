// Modo Recepção (atendente): a IA dá boas-vindas, pergunta só o que a empresa definiu,
// pula o que o lead já disse, lança o lead no CRM (resumo, temperatura e motivo) e passa
// pro vendedor da vez. Configurado em sdr_mode_config (o Cockpit grava essa tela).
import type OpenAI from 'openai'
import { createServiceClient } from '@/lib/supabase/server'
import { distributeQueuedConversations } from '@/lib/sdr/distribute'
import { logCompanyNotice } from '@/lib/notifications/server'

type Supabase = ReturnType<typeof createServiceClient>

export type RecepcaoField = { name: string; label: string; required?: boolean }
export type RecepcaoRules = { welcome_message?: string | null; continue_out_of_hours?: boolean }

const NIVEL: Record<string, string> = { quente: 'Quente 🔥', morno: 'Morno 🌡️', frio: 'Frio ❄️' }

export async function loadRecepcaoConfig(companyId: number, supabase: Supabase) {
  try {
    const { data } = await supabase
      .from('sdr_mode_config')
      .select('mode, briefing_fields, qualification_rules, out_of_hours_message')
      .eq('company_id', companyId)
      .limit(1)
      .maybeSingle()
    if (data?.mode !== 'recepcao') return null
    const fields = ((data.briefing_fields as RecepcaoField[] | null) ?? []).filter((f) => f?.label)
    return {
      fields: fields.length ? fields : [{ name: 'nome', label: 'Nome', required: true }, { name: 'interesse', label: 'O que precisa', required: true }],
      rules: ((data.qualification_rules as RecepcaoRules | null) ?? {}) as RecepcaoRules,
      outOfHoursMessage: (data.out_of_hours_message as string | null) ?? null,
    }
  } catch {
    return null
  }
}

type Out = {
  briefing: Record<string, string | null>
  temperatura: 'quente' | 'morno' | 'frio'
  motivo: string
  resumo: string
  completo: boolean
  resposta: string
  etiquetas?: string[]
}

/** Roda um turno da recepção. Devolve true quando tratou a mensagem (o motor normal não roda). */
export async function runRecepcao(o: {
  companyId: number
  companyName: string
  conversationId: string
  leadId: number | null
  leadName: string
  phone: string
  openai: OpenAI
  supabase: Supabase
  withinHours: boolean
  send: (texts: string[]) => Promise<void>
  log: (action: string, data: Record<string, unknown>) => Promise<void>
}): Promise<boolean> {
  const cfg = await loadRecepcaoConfig(o.companyId, o.supabase)
  if (!cfg) return false
  if (!o.withinHours && !cfg.rules.continue_out_of_hours) return false

  const { supabase, conversationId } = o
  const [{ data: conv }, { data: hist }, { data: tagRows }] = await Promise.all([
    supabase.from('conversas_do_whatsapp').select('briefing, nome_do_contato, etiquetas').eq('id', conversationId).maybeSingle(),
    supabase
      .from('mensagens_do_whatsapp')
      .select('direcao, texto_da_mensagem, tipo_de_mensagem')
      .eq('id_da_conversacao', conversationId)
      .order('carimbo_de_data_e_hora', { ascending: false })
      .limit(40),
    supabase.from('tags').select('tag_name, ai_can_apply').eq('company_id', o.companyId),
  ])
  const tagsIa = ((tagRows ?? []) as { tag_name: string; ai_can_apply: boolean | null }[]).filter((t) => t.ai_can_apply !== false).map((t) => t.tag_name)
  const msgs = ((hist ?? []) as { direcao: string; texto_da_mensagem: string | null; tipo_de_mensagem: string | null }[]).reverse()
  const jaFalamos = msgs.some((m) => m.direcao === 'outbound')
  const transcript = msgs
    .map((m) => `${m.direcao === 'outbound' ? 'Nós' : 'Cliente'}: ${m.texto_da_mensagem?.trim() || `(${m.tipo_de_mensagem ?? 'mídia'})`}`)
    .join('\n')
  const atual = ((conv?.briefing as Record<string, string> | null) ?? {}) as Record<string, string>
  const welcome = cfg.rules.welcome_message?.trim() || ''

  const system = `Você é a recepção da empresa ${o.companyName || 'da empresa'} no WhatsApp. Seu trabalho: receber o cliente, coletar só as informações abaixo e passar pro vendedor. Você NÃO vende, NÃO passa preço, NÃO faz orçamento e NÃO responde dúvida técnica: se o cliente perguntar algo assim, diga que o vendedor responde e siga.

Informações a coletar (pergunte UMA por vez, na ordem, e pule o que o cliente já respondeu em qualquer mensagem):
${cfg.fields.map((f) => `- ${f.name}: ${f.label}`).join('\n')}

Regras de escrita: português do Brasil, tom de WhatsApp, curto (até 2 frases), simpático, sem listas, sem markdown, sem travessão. Use o primeiro nome do cliente quando souber.
${welcome && !jaFalamos ? `Esta é a PRIMEIRA mensagem nossa: a resposta tem que ser exatamente este texto: "${welcome}"` : ''}

${tagsIa.length ? `Etiquetas que você pode marcar quando a conversa deixar claro (senão, nenhuma): ${tagsIa.join(', ')}.
` : ''}
Responda só em JSON:
{"briefing": {<cada name>: "valor dito pelo cliente" ou null}, "temperatura": "quente"|"morno"|"frio", "motivo": "por que essa temperatura, 1 frase com fatos da conversa", "resumo": "resumo do lead pro vendedor em 1 a 3 frases", "completo": true se todas as informações obrigatórias já foram ditas, "resposta": "próxima mensagem pro cliente (vazio se completo)", "etiquetas": ["nomes exatos da lista acima que se aplicam"]}
Temperatura: quente = necessidade clara e prazo curto ou pediu orçamento/visita; morno = interesse real sem urgência; frio = só pesquisando, fora do perfil ou sem resposta clara.`

  let out: Out
  try {
    const r = await o.openai.chat.completions.create({
      model: 'gpt-4.1',
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: `Já coletado: ${JSON.stringify(atual)}\n\nConversa até agora:\n${transcript}` },
      ],
    })
    out = JSON.parse(r.choices[0]?.message?.content ?? '{}') as Out
  } catch (e: any) {
    console.error(`[SDR:${o.companyId}] recepção: falha no modelo`, e?.message)
    return false
  }

  const briefing: Record<string, string> = { ...atual }
  for (const [k, v] of Object.entries(out.briefing ?? {})) if (typeof v === 'string' && v.trim()) briefing[k] = v.trim()
  const faltam = cfg.fields.filter((f) => f.required !== false && !briefing[f.name])
  const completo = faltam.length === 0 && (jaFalamos || !welcome)

  const atuais = ((conv?.etiquetas as string[] | null) ?? [])
  const novas = (out.etiquetas ?? []).filter((t) => tagsIa.includes(t) && !atuais.includes(t))
  await supabase.from('conversas_do_whatsapp').update({ briefing, ...(novas.length ? { etiquetas: [...atuais, ...novas] } : {}) }).eq('id', conversationId)
  if (o.leadId) {
    const temp = NIVEL[out.temperatura] ?? null
    const linhas = cfg.fields.filter((f) => briefing[f.name]).map((f) => `- ${f.label}: ${briefing[f.name]}`)
    await supabase
      .from('leads')
      .update({
        resumo_ia: [out.resumo?.trim(), ...linhas].filter(Boolean).join('\n'),
        mql_resumo: out.motivo?.trim() || null,
        ...(temp ? { nivel_interesse: temp } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', o.leadId)
  }

  if (!completo) {
    const texto = (welcome && !jaFalamos ? welcome : out.resposta?.trim()) || `Me conta: ${faltam[0]?.label.toLowerCase()}?`
    await o.send([texto])
    await o.log('recepcao_pergunta', { faltam: faltam.map((f) => f.name) })
    return true
  }

  // tudo coletado: fila, rodízio e aviso ao cliente com o nome de quem vai atender
  await supabase
    .from('conversas_do_whatsapp')
    .update({
      agente_pausado: true,
      pause_reason: 'recepcao',
      agente_pausado_em: new Date().toISOString(),
      current_status: 'livre',
      kanban_stage: 'fila',
      queue_entered_at: new Date().toISOString(),
    })
    .eq('id', conversationId)

  let vendedor: string | null = null
  if (o.withinHours) {
    await distributeQueuedConversations(o.companyId, supabase).catch(() => null)
    const { data: c2 } = await supabase.from('conversas_do_whatsapp').select('current_attendant_id').eq('id', conversationId).maybeSingle()
    if (c2?.current_attendant_id) {
      const { data: at } = await supabase.from('attendants').select('name').eq('id', c2.current_attendant_id).maybeSingle()
      vendedor = (at?.name as string | undefined)?.split(/\s+/)[0] ?? null
    }
  }
  const nome = (briefing.nome || o.leadName || conv?.nome_do_contato || '').split(/\s+/)[0]
  const oi = nome ? `Perfeito, ${nome}.` : 'Perfeito.'
  const fim = !o.withinHours
    ? `${oi} Anotei tudo. ${cfg.outOfHoursMessage?.trim() || 'Nosso time volta no próximo horário de atendimento e já chega sabendo de tudo.'}`
    : vendedor
      ? `${oi} Já passei pro ${vendedor}, ele te chama em instantes.`
      : `${oi} Já passei pro nosso time, eles te chamam em instantes.`
  await o.send([fim])

  await logCompanyNotice(supabase, {
    companyId: o.companyId,
    action: 'sdr_handoff',
    description: `${o.leadName || 'Lead'} passou pela recepção${vendedor ? ` e foi pro ${vendedor}` : ''}. ${out.resumo ?? ''}`.trim(),
    metadata: { lead_id: o.leadId, conversation_id: conversationId, reason: 'recepcao', temperatura: out.temperatura },
  }).catch(() => null)
  await o.log('recepcao_handoff', { briefing, vendedor })
  return true
}
