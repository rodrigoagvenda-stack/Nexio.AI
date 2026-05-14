/**
 * Follow-up Engine v2
 *
 * 4 tipos: follow_geral | anti_noshow | remarketing | follow_proposta
 *
 * Regras do fluxo Anti-Noshow V2:
 * - Horário comercial: 7h–22h, seg–sáb (BRT = UTC-3)
 * - Delay anti-ban: 45–135 s entre leads
 * - Typing simulation: 2–5 s por mensagem
 * - Rate limit: 30 disparos / hora / empresa
 * - Pool de mensagens: pick aleatório
 * - Contexto SDR: inclui system_prompt da empresa quando usar_contexto_sdr=true
 * - Credenciais: sdr_configs (decrypt) → platform_config (global) — sem process.env
 */

import { createServiceClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/crypto'
import { getPlatformConfig } from '@/lib/platform-config'
import { createUazapiClient, normalizePhone, sendRichStep, StepTipoMensagem, StepMediaConfig } from './uazapi'

/** Mesma lógica de engine.ts — variações de formato do número BR */
function phoneVariants(phone: string): string[] {
  const variants: string[] = [phone]
  const push = (v: string) => { if (!variants.includes(v)) variants.push(v) }
  if (phone.startsWith('55')) {
    if (phone.length === 13) {
      push(phone.slice(0, 4) + phone.slice(5))
      push('+' + phone)
      push('+' + phone.slice(0, 4) + phone.slice(5))
    } else if (phone.length === 12) {
      push(phone.slice(0, 4) + '9' + phone.slice(4))
      push('+' + phone)
      push('+' + phone.slice(0, 4) + '9' + phone.slice(4))
    } else {
      push('+' + phone)
    }
  }
  return variants
}
import { syslog } from '@/lib/logger'
import OpenAI from 'openai'

// ─── Types ──────────────────────────────────────────────────────────────────

type SequenceTipo = 'follow_geral' | 'anti_noshow' | 'remarketing' | 'follow_proposta' | 'trial_saas'

interface FollowStep {
  id: string
  sequence_id: string
  dia_offset: number
  horario: string
  mensagem: string | null
  pool_mensagens: string[] | null
  usar_ia: boolean
  usar_contexto_sdr: boolean
  ordem: number
  tipo_mensagem: StepTipoMensagem | null
  media_config: StepMediaConfig | null
  condicao: 'sempre' | 'respondeu' | 'sem_resposta' | null
}

interface TrialSaas {
  id: number
  company_id: number
  nome: string
  whatsapp: string
  status: string
  criado_em: string
  trial_days: number
  respondeu: boolean
}

interface FollowSequence {
  id: string
  company_id: number
  nome: string
  tipo: SequenceTipo
  ativo: boolean
}

interface Lead {
  id: number
  company_id: number
  contact_name: string
  whatsapp: string
  status: string
  resumo_ia: string | null
  notes: string | null
  call_de_venda: boolean | null
  call_agendada_para: string | null
  call_status: string | null
}

interface CompanyCtx {
  id: number
  uazapi_url: string
  uazapi_token: string
  openai_key: string
  sdr_prompt: string | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Horário comercial BRT (UTC-3): 7h–22h, seg–sáb */
function isBusinessHours(): boolean {
  const brt = new Date(Date.now() - 3 * 3_600_000)
  const day = brt.getUTCDay()   // 0=Dom 6=Sáb
  const hour = brt.getUTCHours()
  return day >= 1 && day <= 6 && hour >= 7 && hour < 22
}

/** Delay anti-ban: 45–135 s */
async function antiBanDelay(): Promise<void> {
  const ms = 45_000 + Math.floor(Math.random() * 90_000)
  await new Promise((r) => setTimeout(r, ms))
}

/** Escolhe mensagem do pool aleatoriamente, ou mensagem fixa */
function pickMessage(step: FollowStep): string {
  const pool = step.pool_mensagens?.filter(Boolean) ?? []
  if (pool.length > 0) return pool[Math.floor(Math.random() * pool.length)]
  return step.mensagem ?? ''
}

/** Substitui variáveis de template na mensagem */
function substituirVariaveis(texto: string, lead: Lead): string {
  const nome = lead.contact_name || 'você'
  const primeiroNome = nome.split(' ')[0]
  const status = lead.status || ''
  const dataCall = lead.call_agendada_para
    ? new Date(lead.call_agendada_para).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
    : ''
  return texto
    .replace(/\{nome\}/gi, nome)
    .replace(/\{name\}/gi, nome)
    .replace(/\{primeiro_nome\}/gi, primeiroNome)
    .replace(/\{first_name\}/gi, primeiroNome)
    .replace(/\{status\}/gi, status)
    .replace(/\{data_call\}/gi, dataCall)
    .replace(/\{horario_call\}/gi, dataCall)
}

type Supabase = ReturnType<typeof createServiceClient>

async function withinRateLimit(companyId: number, supabase: Supabase): Promise<boolean> {
  const since = new Date(Date.now() - 3_600_000).toISOString()
  const { count } = await supabase
    .from('follow_executions')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('status', 'sent')
    .gte('disparado_em', since)
  return (count ?? 0) < 30
}

async function stepJaDisparado(leadId: number, stepId: string, supabase: Supabase): Promise<boolean> {
  const { data } = await supabase
    .from('follow_executions')
    .select('id')
    .eq('lead_id', leadId)
    .eq('step_id', stepId)
    .maybeSingle()
  return !!data
}

async function stepJaDisparadoTrial(trialId: number, stepId: string, supabase: Supabase): Promise<boolean> {
  const { data } = await supabase
    .from('follow_executions')
    .select('id')
    .eq('trial_id', trialId)
    .eq('step_id', stepId)
    .maybeSingle()
  return !!data
}

async function leadJaRespondeuDesde(
  leadId: number,
  companyId: number,
  since: Date,
  supabase: Supabase
): Promise<boolean> {
  const { data } = await supabase
    .from('mensagens_do_whatsapp')
    .select('id')
    .eq('id_do_lead', leadId)
    .eq('company_id', companyId)
    .eq('direcao', 'inbound')
    .gte('created_at', since.toISOString())
    .limit(1)
    .maybeSingle()
  return !!data
}

async function registrarExecucao(
  leadId: number,
  sequenceId: string,
  stepId: string,
  companyId: number,
  status: 'sent' | 'failed' | 'skipped',
  supabase: Supabase
): Promise<void> {
  await supabase.from('follow_executions').insert({
    lead_id: leadId,
    sequence_id: sequenceId,
    step_id: stepId,
    company_id: companyId,
    status,
  })
}

async function gerarMensagemIA(
  lead: Lead,
  step: FollowStep,
  sequence: FollowSequence,
  openai: OpenAI,
  sdrPrompt: string | null
): Promise<string> {
  const systemParts = [
    'Você é um assistente de follow-up de vendas. Gere uma mensagem curta, natural e humana para retomar contato.',
    'Regras: máximo 2-3 linhas, tom amigável sem pressão, não mencione tempo sem resposta, use o contexto disponível.',
    `Contexto do lead:\n- Nome: ${lead.contact_name}\n- Status: ${lead.status}\n- Resumo: ${lead.resumo_ia ?? 'sem histórico'}\n- Sequência: ${sequence.nome} (${sequence.tipo})`,
  ]

  if (step.usar_contexto_sdr && sdrPrompt) {
    systemParts.push(`\nContexto do agente SDR (tom e posicionamento):\n${sdrPrompt}`)
  }

  const completion = await openai.chat.completions.create({
    model: 'gpt-4.1-mini',
    messages: [
      { role: 'system', content: systemParts.join('\n\n') },
      { role: 'user', content: 'Gere a mensagem de follow-up.' },
    ],
    max_tokens: 200,
    temperature: 0.7,
  })

  return completion.choices[0]?.message?.content?.trim()
    ?? pickMessage(step)
    ?? `Oi ${lead.contact_name}! Tudo bem? Gostaria de retomar nossa conversa.`
}

async function enviarMensagem(
  phone: string,
  text: string,
  company: CompanyCtx,
  tipo: StepTipoMensagem = 'text',
  media?: StepMediaConfig | null
): Promise<void> {
  const uazapi = createUazapiClient(company.uazapi_url, company.uazapi_token)
  const typingMs = 2_000 + Math.floor(Math.random() * 3_000)
  const presenceType = tipo === 'audio' || tipo === 'ptt' ? 'recording' : 'composing'
  await uazapi.sendPresence(phone, presenceType, typingMs)
  await new Promise((r) => setTimeout(r, typingMs))
  await sendRichStep(uazapi, phone, tipo, text, media ?? undefined)
}

async function gravarMensagemFollow(
  leadId: number,
  companyId: number,
  phone: string,
  text: string,
  tipo: string,
  supabase: Supabase,
  tipoMensagem: StepTipoMensagem = 'text',
  media?: StepMediaConfig | null
): Promise<void> {
  let convId: number | null = null

  console.log(`[follow] gravarMensagem — lead=${leadId} phone=${phone} tipo=${tipoMensagem}`)

  const { data: byLead } = await supabase
    .from('conversas_do_whatsapp')
    .select('id')
    .eq('company_id', companyId)
    .eq('id_do_lead', leadId)
    .order('hora_da_ultima_mensagem', { ascending: false })
    .limit(1)

  if (byLead?.[0]?.id) {
    convId = byLead[0].id
    console.log(`[follow] conversa encontrada por id_do_lead — conv=${convId}`)
  } else {
    // Usa phoneVariants: encontra a conversa mesmo se o número foi armazenado em formato diferente
    const phoneVars = phoneVariants(phone)
    const { data: byPhone } = await supabase
      .from('conversas_do_whatsapp')
      .select('id')
      .eq('company_id', companyId)
      .in('numero_de_telefone', phoneVars)
      .order('hora_da_ultima_mensagem', { ascending: false })
      .limit(1)

    if (byPhone?.[0]?.id) {
      convId = byPhone[0].id
      console.log(`[follow] conversa encontrada por telefone — conv=${convId}`)
    } else {
      console.warn(`[follow] conversa não encontrada para lead=${leadId} phone=${phone} variants=${JSON.stringify(phoneVariants(phone))} — criando nova`)
      const { data: leadData } = await supabase
        .from('leads')
        .select('contact_name')
        .eq('id', leadId)
        .single()

      const { data: newConv } = await supabase
        .from('conversas_do_whatsapp')
        .insert({
          company_id: companyId,
          id_do_lead: leadId,
          numero_de_telefone: phone,
          nome_do_contato: leadData?.contact_name ?? phone,
          ultima_mensagem: text || `[${tipoMensagem}]`,
          hora_da_ultima_mensagem: new Date().toISOString(),
          status_da_conversa: 'aberto',
          contagem_nao_lida: 0,
        })
        .select('id')
        .single()
      convId = newConv?.id ?? null
    }
  }

  // Para carousel/menu, serializa os itens em url_da_midia (JSON)
  let urlMidia: string | null = null
  if (tipoMensagem === 'carousel' && media?.carousel?.length) {
    urlMidia = JSON.stringify(media.carousel)
  } else if (tipoMensagem === 'menu' && media?.choices?.length) {
    urlMidia = JSON.stringify({ menuType: media.menuType ?? 'button', choices: media.choices, button_actions: media.button_actions ?? {} })
  } else if ((tipoMensagem === 'image' || tipoMensagem === 'video' || tipoMensagem === 'audio' || tipoMensagem === 'ptt' || tipoMensagem === 'document') && media?.file) {
    urlMidia = media.file
  }

  // Para mídia, o caption fica em media.text; usa ele se text (step.mensagem) estiver vazio
  const displayText = text || media?.text || (tipoMensagem !== 'text' ? `[${tipoMensagem}]` : '')

  if (!convId) {
    console.error(`[follow] ERRO: convId null para lead=${leadId} phone=${phone} — mensagem não salva`)
    return
  }

  const { error: insertErr } = await supabase.from('mensagens_do_whatsapp').insert({
    id_da_conversacao: convId,
    id_do_lead: leadId,
    company_id: companyId,
    texto_da_mensagem: displayText,
    tipo_de_mensagem: tipoMensagem,
    url_da_midia: urlMidia,
    direcao: 'outbound',
    sender_type: 'ai',
    status: 'sent',
    nome_do_agente: 'Follow-up SDR',
    carimbo_de_data_e_hora: new Date().toISOString(),
  })

  if (insertErr) {
    console.error(`[follow] ERRO ao inserir mensagem lead=${leadId} conv=${convId}:`, insertErr.message)
    return
  }

  console.log(`[follow] mensagem salva — lead=${leadId} conv=${convId} tipo=${tipoMensagem}`)

  if (convId) {
    await supabase
      .from('conversas_do_whatsapp')
      .update({ ultima_mensagem: displayText, hora_da_ultima_mensagem: new Date().toISOString() })
      .eq('id', convId)
  }

  await supabase.from('follow_logs').insert({
    company_id: companyId,
    lead_id: leadId,
    mensagem: displayText,
    tipo,
    enviado_em: new Date().toISOString(),
  })
}

async function gravarMensagemTrial(
  trialId: number,
  companyId: number,
  text: string,
  tipo: string,
  supabase: Supabase,
  phone?: string,
  nomeContato?: string,
  tipoMensagem: StepTipoMensagem = 'text',
  media?: StepMediaConfig | null
): Promise<void> {
  let convId: number | null = null

  if (phone) {
    const phoneVars = phoneVariants(phone)
    const { data: byPhone } = await supabase
      .from('conversas_do_whatsapp')
      .select('id')
      .eq('company_id', companyId)
      .in('numero_de_telefone', phoneVars)
      .order('hora_da_ultima_mensagem', { ascending: false })
      .limit(1)

    if (byPhone?.[0]?.id) {
      convId = byPhone[0].id
    } else {
      const { data: newConv } = await supabase
        .from('conversas_do_whatsapp')
        .insert({
          company_id: companyId,
          numero_de_telefone: phone,
          nome_do_contato: nomeContato ?? phone,
          ultima_mensagem: text || `[${tipoMensagem}]`,
          hora_da_ultima_mensagem: new Date().toISOString(),
          status_da_conversa: 'aberto',
          contagem_nao_lida: 0,
        })
        .select('id')
        .single()
      convId = newConv?.id ?? null
    }

    if (convId) {
      let urlMidia: string | null = null
      if (tipoMensagem === 'carousel' && media?.carousel?.length) {
        urlMidia = JSON.stringify(media.carousel)
      } else if (tipoMensagem === 'menu' && media?.choices?.length) {
        urlMidia = JSON.stringify({ menuType: media.menuType ?? 'button', choices: media.choices })
      } else if (['image', 'video', 'audio', 'ptt', 'document'].includes(tipoMensagem) && media?.file) {
        urlMidia = media.file
      }

      const displayText = text || media?.text || (tipoMensagem !== 'text' ? `[${tipoMensagem}]` : '')

      await supabase.from('mensagens_do_whatsapp').insert({
        id_da_conversacao: convId,
        company_id: companyId,
        texto_da_mensagem: displayText,
        tipo_de_mensagem: tipoMensagem,
        url_da_midia: urlMidia,
        direcao: 'outbound',
        sender_type: 'ai',
        status: 'sent',
        nome_do_agente: 'Trial SaaS',
        carimbo_de_data_e_hora: new Date().toISOString(),
      })

      await supabase
        .from('conversas_do_whatsapp')
        .update({ ultima_mensagem: text || `[${tipoMensagem}]`, hora_da_ultima_mensagem: new Date().toISOString() })
        .eq('id', convId)
    }
  }

  await supabase.from('follow_logs').insert({
    company_id: companyId,
    trial_id: trialId,
    mensagem: text,
    tipo,
    enviado_em: new Date().toISOString(),
  })
}

// ─── Processadores por tipo ──────────────────────────────────────────────────

async function processFollowGeral(
  company: CompanyCtx,
  sequences: FollowSequence[],
  openai: OpenAI,
  supabase: Supabase
): Promise<number> {
  let sent = 0

  const { data: leads } = await supabase
    .from('leads')
    .select('id, company_id, contact_name, whatsapp, status, resumo_ia, notes, call_de_venda, call_agendada_para, call_status')
    .eq('company_id', company.id)
    .in('status', ['Em contato', 'Interessado'])
    .not('whatsapp', 'is', null)

  for (const sequence of sequences) {
    const { data: steps } = await supabase
      .from('follow_steps')
      .select('*')
      .eq('sequence_id', sequence.id)
      .order('ordem', { ascending: true })
    if (!steps?.length) continue

    for (const step of steps as FollowStep[]) {
      const cutoff = new Date(Date.now() - step.dia_offset * 86_400_000)

      for (const lead of (leads ?? []) as Lead[]) {
        if (!(await withinRateLimit(company.id, supabase))) return sent
        if (await stepJaDisparado(lead.id, step.id, supabase)) continue
        if (await leadJaRespondeuDesde(lead.id, company.id, cutoff, supabase)) continue

        const { data: ultimaMsg } = await supabase
          .from('mensagens_do_whatsapp')
          .select('created_at')
          .eq('id_do_lead', lead.id)
          .eq('direcao', 'inbound')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (!ultimaMsg) continue
        const dias = (Date.now() - new Date(ultimaMsg.created_at).getTime()) / 86_400_000
        if (dias < step.dia_offset) continue

        const phone = normalizePhone(lead.whatsapp)
        const tipo = step.tipo_mensagem ?? 'text'
        const media = step.media_config
        const textoRaw = step.usar_ia
          ? await gerarMensagemIA(lead, step, sequence, openai, company.sdr_prompt)
          : pickMessage(step)
        const texto = substituirVariaveis(textoRaw, lead)

        const precisaTexto = tipo === 'text' || step.usar_ia
        if (precisaTexto && !texto) {
          await registrarExecucao(lead.id, sequence.id, step.id, company.id, 'skipped', supabase)
          continue
        }

        try {
          await enviarMensagem(phone, texto, company, tipo, media)
          await gravarMensagemFollow(lead.id, company.id, phone, texto, 'follow_geral', supabase, tipo as StepTipoMensagem, media)
          await registrarExecucao(lead.id, sequence.id, step.id, company.id, 'sent', supabase)
          sent++
          await antiBanDelay()
        } catch {
          await registrarExecucao(lead.id, sequence.id, step.id, company.id, 'failed', supabase)
        }
      }
    }
  }

  return sent
}

async function processAntiNoshow(
  company: CompanyCtx,
  sequences: FollowSequence[],
  supabase: Supabase
): Promise<number> {
  let sent = 0
  const now = Date.now()

  const { data: leads } = await supabase
    .from('leads')
    .select('id, company_id, contact_name, whatsapp, status, resumo_ia, notes, call_de_venda, call_agendada_para, call_status')
    .eq('company_id', company.id)
    .eq('call_de_venda', true)
    .eq('call_status', 'agendada')
    .not('call_agendada_para', 'is', null)
    .not('whatsapp', 'is', null)

  for (const sequence of sequences) {
    const { data: steps } = await supabase
      .from('follow_steps')
      .select('*')
      .eq('sequence_id', sequence.id)
      .order('ordem', { ascending: true })
    if (!steps?.length) continue

    for (const lead of (leads ?? []) as Lead[]) {
      if (!lead.call_agendada_para) continue
      const callTime = new Date(lead.call_agendada_para).getTime()

      for (const step of steps as FollowStep[]) {
        if (!(await withinRateLimit(company.id, supabase))) return sent
        if (await stepJaDisparado(lead.id, step.id, supabase)) continue

        // dia_offset = horas (negativo = antes, positivo = depois)
        const targetTime = callTime + step.dia_offset * 3_600_000
        const diff = Math.abs(now - targetTime)
        // Janela de ±15 min
        if (diff > 15 * 60_000) continue

        const phone = normalizePhone(lead.whatsapp)
        const tipo = step.tipo_mensagem ?? 'text'
        const media = step.media_config
        const texto = substituirVariaveis(
          pickMessage(step) || `Olá {nome}! Lembrete: temos uma call agendada em breve. Te vejo lá! 🎯`,
          lead
        )

        try {
          await enviarMensagem(phone, texto, company, tipo, media)
          await gravarMensagemFollow(lead.id, company.id, phone, texto, 'anti_noshow', supabase, tipo as StepTipoMensagem, media)
          await registrarExecucao(lead.id, sequence.id, step.id, company.id, 'sent', supabase)
          sent++
          await antiBanDelay()
        } catch {
          await registrarExecucao(lead.id, sequence.id, step.id, company.id, 'failed', supabase)
        }
      }
    }
  }

  return sent
}

async function processRemarketing(
  company: CompanyCtx,
  sequences: FollowSequence[],
  openai: OpenAI,
  supabase: Supabase,
  skipDelay = false
): Promise<number> {
  let sent = 0
  const now = Date.now()

  // Hora atual em BRT (UTC-3)
  const brtNow = new Date(now - 3 * 3_600_000)
  const nowMinutes = brtNow.getUTCHours() * 60 + brtNow.getUTCMinutes()

  const { data: allLeads } = await supabase
    .from('leads')
    .select('id, company_id, contact_name, whatsapp, status, resumo_ia, notes, updated_at')
    .eq('company_id', company.id)
    .eq('status', 'Remarketing')
    .not('whatsapp', 'is', null)

  for (const sequence of sequences) {
    // Extrai lead_id específico do nome (ex: "Remarketing — João [Lead #62]")
    const leadIdMatch = sequence.nome?.match(/\[Lead #(\d+)\]/)
    const targetLeadId = leadIdMatch ? parseInt(leadIdMatch[1]) : null

    const leads = targetLeadId
      ? (allLeads ?? []).filter((l: any) => l.id === targetLeadId)
      : (allLeads ?? [])

    if (!leads.length) continue

    const { data: steps } = await supabase
      .from('follow_steps')
      .select('*')
      .eq('sequence_id', sequence.id)
      .order('ordem', { ascending: true })
    if (!steps?.length) continue

    for (const step of steps as FollowStep[]) {
      // Só dispara se passou da hora configurada (cron roda a cada hora cheia)
      const [hh, mm] = (step.horario ?? '09:00').split(':').map(Number)
      const stepMinutes = hh * 60 + mm
      if (nowMinutes < stepMinutes - 5) continue  // ainda não chegou a hora (5min tolerância)

      for (const lead of leads as unknown as Lead[]) {
        if (!(await withinRateLimit(company.id, supabase))) return sent
        if (await stepJaDisparado(lead.id, step.id, supabase)) continue

        // Verifica se já passaram dia_offset dias desde que o lead foi movido para Remarketing
        const movedAt = new Date((lead as any).updated_at ?? now).getTime()
        const diasDesdeMovimento = (now - movedAt) / 86_400_000
        if (diasDesdeMovimento < step.dia_offset) continue

        const tipo = step.tipo_mensagem ?? 'text'
        const media = step.media_config
        const textoRaw = step.usar_ia
          ? await gerarMensagemIA(lead, step, sequence, openai, company.sdr_prompt)
          : pickMessage(step)
        const texto = substituirVariaveis(textoRaw, lead)

        const precisaTexto = tipo === 'text' || step.usar_ia
        if (precisaTexto && !texto) {
          await registrarExecucao(lead.id, sequence.id, step.id, company.id, 'skipped', supabase)
          continue
        }

        const phone = normalizePhone(lead.whatsapp)
        try {
          await enviarMensagem(phone, texto, company, tipo, media)
          await gravarMensagemFollow(lead.id, company.id, phone, texto, 'remarketing', supabase, tipo as StepTipoMensagem, media)
          await registrarExecucao(lead.id, sequence.id, step.id, company.id, 'sent', supabase)
          sent++
          if (!skipDelay) await antiBanDelay()
        } catch {
          await registrarExecucao(lead.id, sequence.id, step.id, company.id, 'failed', supabase)
        }
      }
    }
  }

  return sent
}

async function processFollowProposta(
  company: CompanyCtx,
  sequences: FollowSequence[],
  openai: OpenAI,
  supabase: Supabase
): Promise<number> {
  let sent = 0

  // Leads que tiveram call realizada e são Interessado/Negociando — proposta enviada, sem resposta
  const { data: leads } = await supabase
    .from('leads')
    .select('id, company_id, contact_name, whatsapp, status, resumo_ia, notes, call_de_venda, call_agendada_para, call_status')
    .eq('company_id', company.id)
    .in('status', ['Interessado', 'Negociando'])
    .eq('call_status', 'realizada')
    .not('whatsapp', 'is', null)

  for (const sequence of sequences) {
    const { data: steps } = await supabase
      .from('follow_steps')
      .select('*')
      .eq('sequence_id', sequence.id)
      .order('ordem', { ascending: true })
    if (!steps?.length) continue

    for (const step of steps as FollowStep[]) {
      const cutoff = new Date(Date.now() - step.dia_offset * 86_400_000)

      for (const lead of (leads ?? []) as Lead[]) {
        if (!(await withinRateLimit(company.id, supabase))) return sent
        if (await stepJaDisparado(lead.id, step.id, supabase)) continue
        if (await leadJaRespondeuDesde(lead.id, company.id, cutoff, supabase)) continue

        // Verifica última mensagem inbound
        const { data: ultimaMsg } = await supabase
          .from('mensagens_do_whatsapp')
          .select('created_at')
          .eq('id_do_lead', lead.id)
          .eq('direcao', 'inbound')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (!ultimaMsg) continue
        const dias = (Date.now() - new Date(ultimaMsg.created_at).getTime()) / 86_400_000
        if (dias < step.dia_offset) continue

        const phone = normalizePhone(lead.whatsapp)
        const tipo = step.tipo_mensagem ?? 'text'
        const media = step.media_config
        const textoRaw = step.usar_ia
          ? await gerarMensagemIA(lead, step, sequence, openai, company.sdr_prompt)
          : pickMessage(step)
        const texto = substituirVariaveis(textoRaw, lead)

        const precisaTexto = tipo === 'text' || step.usar_ia
        if (precisaTexto && !texto) {
          await registrarExecucao(lead.id, sequence.id, step.id, company.id, 'skipped', supabase)
          continue
        }

        try {
          await enviarMensagem(phone, texto, company, tipo, media)
          await gravarMensagemFollow(lead.id, company.id, phone, texto, 'follow_proposta', supabase, tipo as StepTipoMensagem, media)
          await registrarExecucao(lead.id, sequence.id, step.id, company.id, 'sent', supabase)
          sent++
          await antiBanDelay()
        } catch {
          await registrarExecucao(lead.id, sequence.id, step.id, company.id, 'failed', supabase)
        }
      }
    }
  }

  return sent
}

async function processTrialSaas(
  company: CompanyCtx,
  sequences: FollowSequence[],
  supabase: Supabase
): Promise<number> {
  let sent = 0
  const now = Date.now()

  // Verifica modo teste
  const { data: trialCfg } = await supabase
    .from('trial_configs')
    .select('test_mode, test_phone')
    .eq('company_id', company.id)
    .maybeSingle()
  const testMode = trialCfg?.test_mode === true && !!trialCfg?.test_phone
  const testPhone = testMode ? normalizePhone(trialCfg!.test_phone!) : null
  if (testMode) console.log(`[follow:trial] MODO TESTE ativo — redirecionando para ${testPhone}`)

  const { data: trials } = await supabase
    .from('saas_trials')
    .select('id, company_id, nome, whatsapp, status, criado_em, trial_days, respondeu')
    .eq('company_id', company.id)
    .eq('status', 'ativo')
    .not('whatsapp', 'is', null)

  for (const sequence of sequences) {
    const { data: steps } = await supabase
      .from('follow_steps')
      .select('*')
      .eq('sequence_id', sequence.id)
      .order('ordem', { ascending: true })
    if (!steps?.length) continue

    for (const trial of (trials ?? []) as TrialSaas[]) {
      const signupTime = new Date(trial.criado_em).getTime()
      const daysSinceSignup = (now - signupTime) / 86_400_000

      // Skip expired trials (trial_days + 1 day grace)
      if (daysSinceSignup > (trial.trial_days ?? 7) + 1) continue

      for (const step of steps as FollowStep[]) {
        if (!(await withinRateLimit(company.id, supabase))) return sent
        if (await stepJaDisparadoTrial(trial.id, step.id, supabase)) continue

        // ±12h window around dia_offset
        const diff = Math.abs(daysSinceSignup - step.dia_offset)
        if (diff > 0.5) continue

        // Checa condição do step
        const condicao = step.condicao ?? 'sempre'
        if (condicao === 'respondeu' && !trial.respondeu) continue
        if (condicao === 'sem_resposta' && trial.respondeu) continue

        const phone = testPhone ?? normalizePhone(trial.whatsapp)
        const tipo = step.tipo_mensagem ?? 'text'
        const textoRaw = pickMessage(step) || `Oi {nome}! Seu período de teste está em andamento. Precisa de ajuda? 😊`
        const texto = substituirVariaveis(textoRaw, {
          contact_name: trial.nome, whatsapp: trial.whatsapp, status: trial.status,
          resumo_ia: null, notes: null, call_de_venda: null, call_agendada_para: null, call_status: null,
          id: trial.id, company_id: trial.company_id,
        })
        const media = step.media_config

        try {
          await enviarMensagem(phone, texto, company, tipo, media)
          await gravarMensagemTrial(trial.id, company.id, texto, 'trial_saas', supabase, phone, trial.nome, tipo, media)
          await supabase.from('follow_executions').insert({
            trial_id: trial.id,
            sequence_id: sequence.id,
            step_id: step.id,
            company_id: company.id,
            status: 'sent',
          })
          sent++
          await antiBanDelay()
        } catch (err: any) {
          await supabase.from('follow_executions').insert({
            trial_id: trial.id,
            sequence_id: sequence.id,
            step_id: step.id,
            company_id: company.id,
            status: 'failed',
          })
          await syslog({
            type: 'follow_up',
            severity: 'error',
            message: `Trial follow error: ${err.message}`,
            company_id: company.id,
            payload: { trial_id: trial.id },
          })
        }
      }
    }
  }

  return sent
}

// ─── Entry point ─────────────────────────────────────────────────────────────

export async function runFollowUp(): Promise<{ processed: number; errors: string[] }> {
  if (!isBusinessHours()) {
    return { processed: 0, errors: [] }
  }

  const supabase = createServiceClient()
  const errors: string[] = []
  let processed = 0

  try {
    const platformCfg = await getPlatformConfig()

    const { data: configs } = await supabase
      .from('sdr_configs')
      .select('company_id, uazapi_instance_url, uazapi_token, openai_key, prompt, agente_ativo')
      .eq('agente_ativo', true)

    for (const cfg of configs ?? []) {
      try {
        const company: CompanyCtx = {
          id: cfg.company_id,
          uazapi_url: cfg.uazapi_instance_url ?? platformCfg.uazapi_base_url,
          uazapi_token: safeDecrypt(cfg.uazapi_token),
          openai_key: safeDecrypt(cfg.openai_key, platformCfg.openai_api_key),
          sdr_prompt: cfg.prompt ?? null,
        }

        if (!company.uazapi_token) continue

        const openai = new OpenAI({ apiKey: company.openai_key })

        const { data: sequences } = await supabase
          .from('follow_sequences')
          .select('*')
          .eq('company_id', company.id)
          .eq('ativo', true)

        if (!sequences?.length) {
          processed++
          continue
        }

        const byTipo = (tipo: SequenceTipo) =>
          sequences.filter((s: any) => s.tipo === tipo) as FollowSequence[]

        const [g, n, r, p, t] = await Promise.allSettled([
          processFollowGeral(company, byTipo('follow_geral'), openai, supabase),
          processAntiNoshow(company, byTipo('anti_noshow'), supabase),
          processRemarketing(company, byTipo('remarketing'), openai, supabase),
          processFollowProposta(company, byTipo('follow_proposta'), openai, supabase),
          processTrialSaas(company, byTipo('trial_saas'), supabase),
        ])

        const total = [g, n, r, p, t]
          .filter((r) => r.status === 'fulfilled')
          .reduce((acc, r) => acc + (r as PromiseFulfilledResult<number>).value, 0)

        for (const result of [g, n, r, p, t]) {
          if (result.status === 'rejected') {
            errors.push(`Empresa ${company.id}: ${result.reason?.message}`)
          }
        }

        if (total > 0) {
          await syslog({
            type: 'follow_up',
            message: `Follow-up: ${total} mensagens enviadas`,
            company_id: company.id,
            payload: { total },
          })
        }

        processed++
      } catch (err: any) {
        errors.push(`Empresa ${cfg.company_id}: ${err.message}`)
        await syslog({
          type: 'follow_up',
          severity: 'error',
          message: `Follow-up error empresa ${cfg.company_id}: ${err.message}`,
          company_id: cfg.company_id,
          payload: { stack: err.stack },
        })
      }
    }
  } catch (err: any) {
    errors.push(`Erro global: ${err.message}`)
  }

  return { processed, errors }
}

function safeDecrypt(value: string | null | undefined, fallback = ''): string {
  if (!value) return fallback
  if (value.startsWith('plain:')) return value.slice(6)
  // Formato cifrado: iv(32hex):authTag(32hex):cipher
  const parts = value.split(':')
  if (parts.length === 3 && parts[0].length === 32 && parts[1].length === 32) {
    // Retorna fallback (não o token cifrado) para que !token continue funcionando
    try { return decrypt(value) } catch { return fallback }
  }
  return value
}

export async function runRemarketingForCompany(companyId: number, skipDelay = false): Promise<{ sent: number; error?: string }> {
  const supabase = createServiceClient()

  const platformCfg = await getPlatformConfig()
  const { data: cfg } = await supabase
    .from('sdr_configs')
    .select('company_id, uazapi_instance_url, uazapi_token, openai_key, prompt, agente_ativo')
    .eq('company_id', companyId)
    .maybeSingle()

  if (!cfg) return { sent: 0, error: 'sdr_configs não encontrado para esta empresa' }
  if (!cfg.agente_ativo) return { sent: 0, error: 'Agente SDR inativo para esta empresa' }

  const company: CompanyCtx = {
    id: cfg.company_id,
    uazapi_url: cfg.uazapi_instance_url ?? platformCfg.uazapi_base_url,
    uazapi_token: safeDecrypt(cfg.uazapi_token),
    openai_key: safeDecrypt(cfg.openai_key, platformCfg.openai_api_key),
    sdr_prompt: cfg.prompt ?? null,
  }
  if (!company.uazapi_token) return { sent: 0, error: 'Token WhatsApp não configurado' }

  const openai = new OpenAI({ apiKey: company.openai_key })

  const { data: sequences } = await supabase
    .from('follow_sequences')
    .select('*')
    .eq('company_id', companyId)
    .eq('tipo', 'remarketing')
    .eq('ativo', true)

  if (!sequences?.length) return { sent: 0, error: 'Nenhuma sequência de remarketing ativa' }

  const sent = await processRemarketing(company, sequences as FollowSequence[], openai, supabase, skipDelay)
  return { sent }
}
