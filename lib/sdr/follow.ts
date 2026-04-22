/**
 * Follow-up Engine — executa cadências configuráveis por empresa.
 *
 * Tipo 1: follow_geral — dias sem resposta
 * Tipo 2: anti_noshow — baseado na call agendada
 */

import { createServiceClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/crypto'
import { createUazapiClient, normalizePhone } from './uazapi'
import OpenAI from 'openai'

interface FollowStep {
  id: string
  sequence_id: string
  dia_offset: number
  horario: string
  mensagem: string | null
  usar_ia: boolean
  ordem: number
}

interface FollowSequence {
  id: string
  company_id: number
  nome: string
  tipo: 'follow_geral' | 'anti_noshow'
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

async function gerarMensagemIA(
  lead: Lead,
  step: FollowStep,
  sequence: FollowSequence,
  openai: OpenAI
): Promise<string> {
  const systemPrompt = `Você é um assistente de follow-up de vendas. Gere uma mensagem curta, natural e humana para retomar contato com o lead.

Regras:
- Máximo 2-3 linhas
- Tom amigável, sem pressão
- Não mencione quantos dias sem resposta
- Baseie-se no contexto do lead e da sequência

Contexto do lead:
- Nome: ${lead.contact_name}
- Status: ${lead.status}
- Resumo: ${lead.resumo_ia ?? 'sem histórico'}
- Sequência: ${sequence.nome} (${sequence.tipo})`

  const completion = await openai.chat.completions.create({
    model: 'gpt-4.1-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'Gere a mensagem de follow-up agora.' },
    ],
    max_tokens: 200,
    temperature: 0.7,
  })

  return completion.choices[0]?.message?.content?.trim() ?? step.mensagem ?? 'Oi! Tudo bem? Gostaria de retomar nossa conversa.'
}

async function leadJaRespondeuDesde(
  leadId: number,
  companyId: number,
  since: Date,
  supabase: ReturnType<typeof createServiceClient>
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

async function stepJaDisparado(
  leadId: number,
  stepId: string,
  supabase: ReturnType<typeof createServiceClient>
): Promise<boolean> {
  const { data } = await supabase
    .from('follow_executions')
    .select('id')
    .eq('lead_id', leadId)
    .eq('step_id', stepId)
    .maybeSingle()

  return !!data
}

async function registrarExecucao(
  leadId: number,
  sequenceId: string,
  stepId: string,
  status: 'sent' | 'failed' | 'skipped',
  supabase: ReturnType<typeof createServiceClient>
): Promise<void> {
  await supabase.from('follow_executions').insert({
    lead_id: leadId,
    sequence_id: sequenceId,
    step_id: stepId,
    status,
  })
}

async function enviarMensagem(
  phone: string,
  text: string,
  uazapiUrl: string,
  token: string
): Promise<void> {
  const uazapi = createUazapiClient(uazapiUrl, token)
  const typingDelay = Math.floor(Math.random() * 4000) + 3000
  await uazapi.sendPresence(phone, 'composing', typingDelay)
  await new Promise((r) => setTimeout(r, typingDelay))
  await uazapi.sendText({ number: phone, text })
}

async function gravarMensagemFollow(
  leadId: number,
  companyId: number,
  phone: string,
  text: string,
  supabase: ReturnType<typeof createServiceClient>
): Promise<void> {
  // Busca conversa existente
  const { data: conv } = await supabase
    .from('conversas_do_whatsapp')
    .select('id')
    .eq('company_id', companyId)
    .eq('numero_de_telefone', phone)
    .maybeSingle()

  const conversationId = conv?.id

  await supabase.from('mensagens_do_whatsapp').insert({
    id_da_conversacao: conversationId ?? null,
    id_do_lead: leadId,
    company_id: companyId,
    texto_da_mensagem: text,
    tipo_de_mensagem: 'text',
    direcao: 'outbound',
    sender_type: 'ai',
    status: 'sent',
    nome_do_agente: 'Follow-up SDR',
  })

  if (conversationId) {
    await supabase
      .from('conversas_do_whatsapp')
      .update({ ultima_mensagem: text, hora_da_ultima_mensagem: new Date().toISOString() })
      .eq('id', conversationId)
  }

  await supabase.from('follow_logs').insert({
    company_id: companyId,
    lead_id: leadId,
    mensagem: text,
    tipo: 'follow_geral',
    enviado_em: new Date().toISOString(),
  }).maybeSingle()
}

// ─── Follow Geral ───────────────────────────────────────────────

async function processFollowGeral(
  company: { id: number; uazapi_url: string; uazapi_token: string; openai_key: string },
  supabase: ReturnType<typeof createServiceClient>
): Promise<void> {
  const openai = new OpenAI({ apiKey: company.openai_key || process.env.OPENAI_API_KEY })

  const { data: sequences } = await supabase
    .from('follow_sequences')
    .select('*')
    .eq('company_id', company.id)
    .eq('tipo', 'follow_geral')
    .eq('ativo', true)

  if (!sequences?.length) return

  for (const sequence of sequences as FollowSequence[]) {
    const { data: steps } = await supabase
      .from('follow_steps')
      .select('*')
      .eq('sequence_id', sequence.id)
      .order('ordem', { ascending: true })

    if (!steps?.length) continue

    for (const step of steps as FollowStep[]) {
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - step.dia_offset)

      // Leads em contato/interessados sem resposta desde o cutoff
      const { data: leads } = await supabase
        .from('leads')
        .select('id, company_id, contact_name, whatsapp, status, resumo_ia, notes, call_de_venda, call_agendada_para, call_status')
        .eq('company_id', company.id)
        .in('status', ['Em contato', 'Interessado'])
        .not('whatsapp', 'is', null)

      for (const lead of (leads ?? []) as Lead[]) {
        const jaDisparado = await stepJaDisparado(lead.id, step.id, supabase)
        if (jaDisparado) continue

        const respondeu = await leadJaRespondeuDesde(lead.id, company.id, cutoff, supabase)
        if (respondeu) continue

        // Verifica última mensagem recebida
        const { data: ultimaMsg } = await supabase
          .from('mensagens_do_whatsapp')
          .select('created_at')
          .eq('id_do_lead', lead.id)
          .eq('direcao', 'inbound')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (!ultimaMsg) continue

        const ultimaData = new Date(ultimaMsg.created_at)
        const diasSemResposta = Math.floor((Date.now() - ultimaData.getTime()) / 86_400_000)
        if (diasSemResposta < step.dia_offset) continue

        const phone = normalizePhone(lead.whatsapp)
        const texto = step.usar_ia
          ? await gerarMensagemIA(lead, step, sequence, openai)
          : (step.mensagem ?? '')

        if (!texto) {
          await registrarExecucao(lead.id, sequence.id, step.id, 'skipped', supabase)
          continue
        }

        try {
          await enviarMensagem(phone, texto, company.uazapi_url, company.uazapi_token)
          await gravarMensagemFollow(lead.id, company.id, phone, texto, supabase)
          await registrarExecucao(lead.id, sequence.id, step.id, 'sent', supabase)
        } catch {
          await registrarExecucao(lead.id, sequence.id, step.id, 'failed', supabase)
        }
      }
    }
  }
}

// ─── Anti-Noshow ────────────────────────────────────────────────

async function processAntiNoshow(
  company: { id: number; uazapi_url: string; uazapi_token: string; openai_key: string },
  supabase: ReturnType<typeof createServiceClient>
): Promise<void> {
  const { data: sequences } = await supabase
    .from('follow_sequences')
    .select('*')
    .eq('company_id', company.id)
    .eq('tipo', 'anti_noshow')
    .eq('ativo', true)

  if (!sequences?.length) return

  const now = new Date()

  for (const sequence of sequences as FollowSequence[]) {
    const { data: steps } = await supabase
      .from('follow_steps')
      .select('*')
      .eq('sequence_id', sequence.id)
      .order('ordem', { ascending: true })

    if (!steps?.length) continue

    // Leads com call agendada e status não finalizado
    const { data: leads } = await supabase
      .from('leads')
      .select('id, company_id, contact_name, whatsapp, status, resumo_ia, notes, call_de_venda, call_agendada_para, call_status')
      .eq('company_id', company.id)
      .eq('call_de_venda', true)
      .in('call_status', ['agendada', null])
      .not('call_agendada_para', 'is', null)

    for (const lead of (leads ?? []) as Lead[]) {
      if (!lead.call_agendada_para) continue
      const callDate = new Date(lead.call_agendada_para)

      for (const step of steps as FollowStep[]) {
        const jaDisparado = await stepJaDisparado(lead.id, step.id, supabase)
        if (jaDisparado) continue

        // dia_offset negativo = antes da call, positivo = depois
        const targetTime = new Date(callDate.getTime() + step.dia_offset * 3_600_000)
        const diff = Math.abs(now.getTime() - targetTime.getTime())

        // Janela de 15 min para disparar
        if (diff > 15 * 60_000) continue

        const phone = normalizePhone(lead.whatsapp)
        const texto = step.mensagem ?? `Olá ${lead.contact_name}! Lembrete: temos uma call agendada.`

        try {
          await enviarMensagem(phone, texto, company.uazapi_url, company.uazapi_token)
          await gravarMensagemFollow(lead.id, company.id, phone, texto, supabase)
          await registrarExecucao(lead.id, sequence.id, step.id, 'sent', supabase)
        } catch {
          await registrarExecucao(lead.id, sequence.id, step.id, 'failed', supabase)
        }
      }
    }
  }
}

// ─── Entry point ────────────────────────────────────────────────

export async function runFollowUp(): Promise<{ processed: number; errors: string[] }> {
  const supabase = createServiceClient()
  const errors: string[] = []
  let processed = 0

  try {
    // Busca todas as empresas com SDR ativo e follow configurado
    const { data: configs } = await supabase
      .from('sdr_configs')
      .select('company_id, uazapi_instance_url, uazapi_token, openai_key, agente_ativo')
      .eq('agente_ativo', true)

    for (const cfg of configs ?? []) {
      try {
        const company = {
          id: cfg.company_id,
          uazapi_url: cfg.uazapi_instance_url ?? 'https://nexioai.uazapi.com',
          uazapi_token: cfg.uazapi_token ? decrypt(cfg.uazapi_token) : '',
          openai_key: cfg.openai_key ? decrypt(cfg.openai_key) : '',
        }

        await processFollowGeral(company, supabase)
        await processAntiNoshow(company, supabase)
        processed++
      } catch (err: any) {
        errors.push(`Empresa ${cfg.company_id}: ${err.message}`)
      }
    }
  } catch (err: any) {
    errors.push(`Erro global: ${err.message}`)
  }

  return { processed, errors }
}
