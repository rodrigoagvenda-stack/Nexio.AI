/**
 * Copiloto do atendimento humano. Empresas em que a EQUIPE conversa com o lead (IA desligada pra responder),
 * mas a IA acompanha a conversa: escreve o resumo, dá a temperatura (quente, morno, frio) e diz em que etapa do
 * funil o lead está. Nunca manda mensagem.
 *
 * Roda pelo mesmo caminho do SDR: webhook salva a mensagem e abre o job (sdr_jobs) -> o worker espera o lead
 * terminar de digitar (buffer de 30s) -> processSdrMessage vê que o agente está desligado e chama runCopiloto no
 * lugar de responder. Resposta da equipe (Cockpit ou celular) também abre o job, pra ler proposta/agendamento.
 *
 * Liga por empresa: companies.features.copiloto = true.
 */
import type OpenAI from 'openai'
import type { createServiceClient } from '@/lib/supabase/server'
import { chatV3 } from './v3/extractor'
import { understandMedia } from './media-understanding'
import { checkTenantQuota, recordUsage, type UsageAcc } from '@/lib/billing/usage'

type Supabase = ReturnType<typeof createServiceClient>

const MAX_MSGS = 80
const MAX_MEDIA = 3
const NIVEL: Record<string, string> = { quente: 'Quente 🔥', morno: 'Morno 🟡', frio: 'Frio ❄️' }
export const ETAPAS = ['novo', 'qualificado', 'agendado', 'proposta', 'fechado', 'perdido'] as const
export type CopilotoEtapa = (typeof ETAPAS)[number]
export type CopilotoLeitura = {
  etapa: CopilotoEtapa
  quando: string | null
  valor: number | null
  motivo_perda: string | null
  proximo_passo: string | null
  at: string
}

const SCHEMA = {
  type: 'object',
  properties: {
    resumo: { type: 'string' },
    temperatura: { type: 'string', enum: ['quente', 'morno', 'frio', 'indefinido'] },
    motivo_temperatura: { type: 'string' },
    etapa: { type: 'string', enum: [...ETAPAS] },
    quando: { type: ['string', 'null'] },
    valor: { type: ['number', 'null'] },
    motivo_perda: { type: ['string', 'null'] },
    proximo_passo: { type: ['string', 'null'] },
  },
  required: ['resumo', 'temperatura', 'motivo_temperatura', 'etapa', 'quando', 'valor', 'motivo_perda', 'proximo_passo'],
  additionalProperties: false,
} as const

/** A empresa usa o copiloto? (features.copiloto) */
export async function copilotoLigado(companyId: number, supabase: Supabase): Promise<boolean> {
  const { data } = await supabase.from('companies').select('features').eq('id', companyId).maybeSingle()
  return Boolean((data?.features as Record<string, unknown> | null)?.copiloto)
}

const hojeSP = () => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'full', timeStyle: 'short' }).format(new Date())
const horaSP = (iso: string) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))

type Row = { id: number; direcao: string | null; sender_type: string | null; nome_do_agente: string | null; texto_da_mensagem: string | null; tipo_de_mensagem: string | null; url_da_midia: string | null; metadados: unknown; carimbo_de_data_e_hora: string }

/**
 * Lê a conversa e atualiza o lead. Devolve true se rodou (a empresa usa o copiloto), false se não é com ele.
 * Nunca joga erro pra fora: o job do worker não pode quebrar por causa disso.
 */
export async function runCopiloto(companyId: number, phone: string, openai: OpenAI, supabase: Supabase): Promise<boolean> {
  try {
    if (!(await copilotoLigado(companyId, supabase))) return false
    const quota = await checkTenantQuota(companyId, supabase)
    if (!quota.allowed) {
      console.warn(`[copiloto:${companyId}] franquia estourada, leitura pulada (${phone})`)
      return true
    }

    const { data: conv } = await supabase
      .from('conversas_do_whatsapp')
      .select('id, id_do_lead, nome_do_contato')
      .eq('company_id', companyId)
      .eq('numero_de_telefone', phone)
      .maybeSingle()
    if (!conv?.id_do_lead) return true

    const [{ data: lead }, { data: msgsDesc }, { data: company }] = await Promise.all([
      supabase.from('leads').select('id, resumo_ia, contact_name').eq('id', conv.id_do_lead).maybeSingle(),
      supabase
        .from('mensagens_do_whatsapp')
        .select('id, direcao, sender_type, nome_do_agente, texto_da_mensagem, tipo_de_mensagem, url_da_midia, metadados, carimbo_de_data_e_hora')
        .eq('id_da_conversacao', conv.id)
        .or('is_deleted.is.null,is_deleted.eq.false')
        .order('carimbo_de_data_e_hora', { ascending: false })
        .limit(MAX_MSGS),
      supabase.from('companies').select('name').eq('id', companyId).maybeSingle(),
    ])
    if (!lead) return true
    const rows = ((msgsDesc ?? []) as Row[]).reverse()
    if (!rows.some((r) => r.direcao === 'inbound')) return true

    // áudio e foto sem conteúdo (do lead ou da equipe): entende os mais recentes, uma vez só (fica gravado)
    const acc: UsageAcc = []
    const semConteudo = rows
      .filter((r) => ['audio', 'ptt', 'image'].includes(r.tipo_de_mensagem ?? '') && /^https?:\/\//i.test(r.url_da_midia ?? '') && !(r.metadados as { transcricao?: string } | null)?.transcricao)
      .slice(-MAX_MEDIA)
    await Promise.all(semConteudo.map(async (r) => {
      try {
        const texto = await understandMedia(r.tipo_de_mensagem as string, r.url_da_midia as string, openai)
        if (!texto) return
        const metadados = { ...((r.metadados as Record<string, unknown> | null) ?? {}), transcricao: texto, transcricao_origem: 'copiloto' }
        r.metadados = metadados
        await supabase.from('mensagens_do_whatsapp').update({ metadados }).eq('id', r.id)
      } catch (e: any) {
        console.error(`[copiloto:${companyId}] entender mídia ${r.id} falhou:`, e?.message)
      }
    }))

    const nomeLead = lead.contact_name || conv.nome_do_contato || 'Lead'
    const linhas = rows.map((r) => {
      const t = (r.metadados as { transcricao?: string } | null)?.transcricao
      const tipo = r.tipo_de_mensagem ?? 'text'
      const corpo = t ? `${tipo === 'image' ? '[foto] ' : '[áudio] '}${t}` : tipo === 'location' ? `[localização] ${r.texto_da_mensagem ?? ''}` : (r.texto_da_mensagem ?? '').trim() || `[${tipo}]`
      const quem = r.direcao === 'inbound' ? nomeLead : r.sender_type === 'ai' || r.sender_type === 'ia' ? 'IA' : (r.nome_do_agente || 'Equipe')
      return `[${horaSP(r.carimbo_de_data_e_hora)}] ${quem}: ${corpo}`
    })

    const completion = await chatV3(openai, {
      temperature: 0,
      max_tokens: 1500,
      response_format: { type: 'json_schema', json_schema: { name: 'copiloto', strict: true, schema: SCHEMA as any } },
      messages: [
        {
          role: 'system',
          content: `Você acompanha conversas de WhatsApp entre a equipe comercial da empresa "${company?.name ?? ''}" e um lead. Você NÃO conversa com ninguém: só lê e organiza o funil pro vendedor.
Agora é ${hojeSP()} (horário de Brasília).

Devolva:
- resumo: até 120 palavras, em tópicos curtos começando com "• ", em português. Quem é o lead (nome, cidade, o que faz, se disse), o que ele quer, o que já foi conversado e combinado, objeções ou dúvidas, e o próximo passo. Só fatos da conversa, nada inventado.
- temperatura: "quente" (pediu preço/proposta/horário, quer resolver logo, deu sinais claros de compra), "morno" (tem interesse real mas ainda pesquisando, sem urgência ou com objeção aberta), "frio" (só curiosidade, respostas curtas sem engajar, sumiu depois de receber informação, disse que não é agora), "indefinido" (conversa curta demais pra julgar, ex.: só um "oi").
- motivo_temperatura: uma frase com o porquê, citando o que o lead disse.
- etapa (onde o lead está HOJE no funil):
  "novo" = só chegou ou ainda não disse o que quer;
  "qualificado" = já disse o que precisa e tem perfil/interesse real;
  "agendado" = ficou combinado dia E hora de reunião, consulta, visita ou ligação;
  "proposta" = a equipe já mandou orçamento, proposta ou preço fechado pra ele decidir;
  "fechado" = o lead confirmou a compra, pagou ou fechou o contrato;
  "perdido" = o lead disse claramente que não quer, desistiu ou fechou com outro.
  Na dúvida entre duas etapas, fique com a anterior.
- quando: só se etapa = "agendado": data e hora combinadas em ISO 8601 com fuso de Brasília (ex.: 2026-11-27T14:30:00-03:00). Senão null.
- valor: só se etapa = "fechado" e o valor fechado aparece na conversa (número, em reais). Senão null.
- motivo_perda: só se etapa = "perdido": o motivo em poucas palavras. Senão null.
- proximo_passo: o que a equipe deveria fazer agora, em uma frase curta. null se não houver.`,
        },
        {
          role: 'user',
          content: `RESUMO ANTERIOR:\n${lead.resumo_ia?.trim() || '(nenhum)'}\n\nCONVERSA (mais antigas primeiro):\n${linhas.join('\n')}`,
        },
      ],
    }, 'copiloto')
    if (completion.usage) acc.push({ agent: 'copiloto', model: completion.model, promptTokens: completion.usage.prompt_tokens, completionTokens: completion.usage.completion_tokens, totalTokens: completion.usage.total_tokens })
    recordUsage(companyId, acc, supabase, quota.packageId).catch((e) => console.error('[copiloto] uso:', e?.message))

    const raw = JSON.parse(completion.choices[0]?.message?.content || '{}') as {
      resumo?: string; temperatura?: string; motivo_temperatura?: string; etapa?: string; quando?: string | null; valor?: number | null; motivo_perda?: string | null; proximo_passo?: string | null
    }
    const etapa = (ETAPAS as readonly string[]).includes(raw.etapa ?? '') ? (raw.etapa as CopilotoEtapa) : 'novo'
    const quando = etapa === 'agendado' && raw.quando && !Number.isNaN(new Date(raw.quando).getTime()) ? new Date(raw.quando).toISOString() : null
    const leitura: CopilotoLeitura = {
      etapa: etapa === 'agendado' && !quando ? 'qualificado' : etapa,
      quando,
      valor: etapa === 'fechado' && typeof raw.valor === 'number' && raw.valor > 0 ? raw.valor : null,
      motivo_perda: etapa === 'perdido' ? raw.motivo_perda?.trim() || null : null,
      proximo_passo: raw.proximo_passo?.trim() || null,
      at: new Date().toISOString(),
    }
    const patch: Record<string, unknown> = { copiloto: leitura, updated_at: leitura.at }
    if (raw.resumo?.trim()) patch.resumo_ia = raw.resumo.trim()
    if (raw.temperatura && NIVEL[raw.temperatura]) {
      patch.nivel_interesse = NIVEL[raw.temperatura]
      patch.mql_resumo = raw.motivo_temperatura?.trim() || null
    }
    const { error } = await supabase.from('leads').update(patch).eq('id', lead.id).eq('company_id', companyId)
    if (error) console.error(`[copiloto:${companyId}] gravar lead falhou:`, error.message)
    else console.log(`[copiloto:${companyId}] lead ${lead.id} lido: ${leitura.etapa}, ${raw.temperatura}`)
    return true
  } catch (e: any) {
    console.error(`[copiloto:${companyId}] falhou (${phone}):`, e?.message)
    return true
  }
}
