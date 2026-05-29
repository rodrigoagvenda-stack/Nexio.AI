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
import { getRedis } from './redis'
import {
  acquireSendLock, releaseSendLock, sendLockKey,
  recordCircuitFailure, recordCircuitSuccess, isCircuitOpen,
  getFailedCount, shouldRetryNow, MAX_RETRIES, backoffMs,
  isUazapiHealthy, isFatigued, recordFatigue, getBestSendHour,
} from './reliability'

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
  condicao_estagio: string | null
  sdr_ativo: boolean | null
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
  estagio: string | null
}

interface RemarketingCanvasConfig {
  statusFiltros?: string[]
  diasInativo?: number
}

interface FollowSequence {
  id: string
  company_id: number
  nome: string
  tipo: SequenceTipo
  ativo: boolean
  staging?: boolean
  canvas_config?: {
    remarketing?: RemarketingCanvasConfig
    expira_em_dias?: number
    eventoEntrada?: 'novo_lead' | 'mudanca_status' | 'webhook'
  } | null
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
  meet_url?: string | null
}

interface CompanyCtx {
  id: number
  uazapi_url: string
  uazapi_token: string
  openai_key: string
  sdr_prompt: string | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24
  const m = minutes % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}h`
}

/** Horário comercial BRT (UTC-3): 7h–22h, seg–sáb */
function isBusinessHours(): boolean {
  const brt = new Date(Date.now() - 3 * 3_600_000)
  const day = brt.getUTCDay()   // 0=Dom 6=Sáb
  const hour = brt.getUTCHours()
  return day >= 1 && day <= 6 && hour >= 7 && hour < 22
}

/**
 * Parseia timestamps do banco como BRT quando não têm timezone explícito.
 * O Supabase pode devolver "2026-05-26T15:30:00" sem offset — o lead entrou
 * o horário em BRT, então devemos tratá-lo como BRT, não UTC.
 */
function parseBrt(ts: string): Date {
  if (!ts) return new Date()
  // Aceita: Z, +00:00, +00 (formato Supabase sem dois pontos)
  if (/[Zz]$/.test(ts) || /[+-]\d{2}:?\d{2}$/.test(ts)) return new Date(ts.replace(' ', 'T'))
  // Naive (sem timezone) = trata como BRT (UTC-3)
  return new Date(ts.replace(' ', 'T') + '-03:00')
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
    ? parseBrt(lead.call_agendada_para).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
    : ''
  const horaCall = lead.call_agendada_para
    ? parseBrt(lead.call_agendada_para).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
    : ''
  const linkMeet = lead.meet_url ?? ''
  return texto
    .replace(/\{nome\}/gi, nome)
    .replace(/\{name\}/gi, nome)
    .replace(/\{primeiro_nome\}/gi, primeiroNome)
    .replace(/\{first_name\}/gi, primeiroNome)
    .replace(/\{status\}/gi, status)
    .replace(/\{data_call\}/gi, dataCall)
    .replace(/\{horario_call\}/gi, horaCall)
    .replace(/\{hora_reuniao\}/gi, horaCall)
    .replace(/\{link_meet\}/gi, linkMeet)
    .replace(/\{meet_url\}/gi, linkMeet)
}

type Supabase = ReturnType<typeof createServiceClient>

// ─── Graph Traversal ─────────────────────────────────────────────────────────

interface GraphEdge {
  targetId: string
  handle?: string
}

interface CanvasEdgeConfig {
  sourceIdx: number
  targetIdx: number
  sourceHandle?: string
  targetHandle?: string
}

/** Builds forward adjacency map from canvas_config.edges. Returns entry node (first after trigger). */
function buildGraphAdj(
  steps: FollowStep[],
  canvasConfig: Record<string, unknown> | null | undefined
): { adj: Map<string, GraphEdge[]>; entryId: string | null } {
  const sorted = [...steps].sort((a, b) => a.ordem - b.ordem)
  const adj = new Map<string, GraphEdge[]>()
  for (const s of sorted) adj.set(s.id, [])

  const edges: CanvasEdgeConfig[] = (canvasConfig as any)?.edges ?? []
  let entryId: string | null = sorted[0]?.id ?? null  // linear fallback

  if (edges.length > 0) {
    entryId = null
    for (const e of edges) {
      const srcId = e.sourceIdx === -1 ? '__trigger__' : sorted[e.sourceIdx]?.id
      const tgtId = e.targetIdx === -1 ? null : sorted[e.targetIdx]?.id
      if (!srcId || !tgtId) continue
      if (srcId === '__trigger__') {
        if (!entryId) entryId = tgtId
      } else {
        const list = adj.get(srcId) ?? []
        list.push({ targetId: tgtId, handle: e.sourceHandle })
        adj.set(srcId, list)
      }
    }
  } else {
    // No edges stored → legacy linear layout: connect by ordem
    for (let i = 0; i < sorted.length - 1; i++) {
      adj.set(sorted[i].id, [{ targetId: sorted[i + 1].id }])
    }
  }

  return { adj, entryId }
}

/** Evaluates the branch handle for a condition or sentiment node. */
async function evaluateBranch(
  step: FollowStep,
  lead: Lead,
  companyId: number,
  supabase: Supabase
): Promise<string> {
  const tipo = step.tipo_mensagem as string

  if (tipo === 'condicao') {
    const cfg = step.media_config as any
    const variavel: string = cfg?.variavel ?? 'respondeu'
    const operador: string = cfg?.operador ?? 'eq'
    const valor: string = cfg?.valor ?? ''

    if (variavel === 'respondeu') {
      const replied = await leadJaRespondeuDesde(lead.id, companyId, new Date(Date.now() - 7 * 86_400_000), supabase)
      return replied ? 'sim' : 'nao'
    }

    let atual: string | null = null
    if (variavel === 'status' || variavel === 'estagio') {
      atual = lead.status
    } else if (variavel === 'resposta_botao') {
      const { data: msg } = await supabase
        .from('mensagens_do_whatsapp')
        .select('texto_da_mensagem')
        .eq('id_do_lead', lead.id)
        .eq('direcao', 'inbound')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      atual = msg?.texto_da_mensagem ?? null
    } else if (variavel === 'custom') {
      const customVar = cfg?.customVariavel ?? ''
      // Custom: treat like respondeu with a keyword check
      const replied = await leadJaRespondeuDesde(lead.id, companyId, new Date(Date.now() - 7 * 86_400_000), supabase)
      if (customVar && replied) {
        const { data: msgs } = await supabase
          .from('mensagens_do_whatsapp')
          .select('texto_da_mensagem')
          .eq('id_do_lead', lead.id).eq('direcao', 'inbound')
          .gte('created_at', new Date(Date.now() - 7 * 86_400_000).toISOString())
        const matched = (msgs ?? []).some(m => m.texto_da_mensagem?.toLowerCase().includes(customVar.toLowerCase()))
        return matched ? 'sim' : 'nao'
      }
      return replied ? 'sim' : 'nao'
    }

    const match = operador === 'eq' ? atual === valor
      : operador === 'neq' ? atual !== valor
      : operador === 'contains' ? (atual?.toLowerCase().includes(valor.toLowerCase()) ?? false)
      : operador === 'gte' ? Number(atual) >= Number(valor)
      : operador === 'lte' ? Number(atual) <= Number(valor)
      : false

    return match ? 'sim' : 'nao'
  }

  if (tipo === 'sentiment') {
    try {
      const redis = getRedis()
      const sentiment = await redis.get(`follow:sentiment:${companyId}:${lead.id}`)
      return (sentiment as string | null) ?? 'neutro'
    } catch { return 'neutro' }
  }

  return 'sim'
}

/**
 * Checks if a step is reachable for a given lead based on graph structure.
 * Uses pre-loaded firedIds to avoid extra DB queries.
 * A step is reachable if:
 *   - It's the entry point, OR
 *   - At least one predecessor is fired AND (if predecessor is branching) the branch matches current lead state.
 * Falls back to true when no canvas edges are stored (linear mode).
 */
async function isStepReachableFromGraph(
  stepId: string,
  entryId: string | null,
  adj: Map<string, GraphEdge[]>,
  firedIds: Set<string>,
  steps: FollowStep[],
  lead: Lead,
  companyId: number,
  supabase: Supabase
): Promise<boolean> {
  // No graph edges → all steps are reachable (linear mode)
  if (adj.size === 0) return true

  // Entry node is always reachable
  if (stepId === entryId) return true

  // Build reverse adjacency for this specific step
  const predecessors: { srcId: string; handle?: string }[] = []
  for (const [srcId, edges] of adj.entries()) {
    for (const e of edges) {
      if (e.targetId === stepId) predecessors.push({ srcId, handle: e.handle })
    }
  }

  if (predecessors.length === 0) return false  // no path from trigger

  for (const pred of predecessors) {
    if (!firedIds.has(pred.srcId)) continue  // predecessor not yet fired

    // If edge has a branch handle, the source is a branching node — evaluate
    if (pred.handle) {
      const srcStep = steps.find(s => s.id === pred.srcId)
      if (!srcStep) continue
      const branchResult = await evaluateBranch(srcStep, lead, companyId, supabase)
      if (branchResult !== pred.handle) continue  // wrong branch for this lead
    }

    return true  // predecessor fired and branch matches
  }

  return false
}

/** Hot leads (call_de_venda + Interessado) são processados antes dos demais. */
function leadPriority(lead: Lead): number {
  return (lead.call_de_venda ? 20 : 0) + (lead.status === 'Interessado' ? 10 : 0) + (lead.status === 'Em contato' ? 5 : 0)
}

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
    .in('status', ['sent', 'skipped', 'dlq']) // 'failed' permite retry
    .maybeSingle()
  return !!data
}

async function stepJaDisparadoTrial(trialId: number, stepId: string, supabase: Supabase): Promise<boolean> {
  const { data } = await supabase
    .from('follow_executions')
    .select('id')
    .eq('trial_id', trialId)
    .eq('step_id', stepId)
    .in('status', ['sent', 'skipped', 'dlq'])
    .maybeSingle()
  return !!data
}

/** Verifica backoff e DLQ antes de cada tentativa. Retorna 'ok' | 'dlq' | 'backoff'. */
async function checkRetry(
  leadOrTrialId: number,
  stepId: string,
  supabase: Supabase,
  isTrial = false,
): Promise<'ok' | 'dlq' | 'backoff'> {
  const failed = await getFailedCount(leadOrTrialId, stepId, supabase, isTrial)
  if (failed === 0) return 'ok'
  if (failed >= MAX_RETRIES) return 'dlq'
  const ready = await shouldRetryNow(leadOrTrialId, stepId, supabase, isTrial)
  return ready ? 'ok' : 'backoff'
}

async function openCircuit(sequenceId: string, companyId: number, supabase: Supabase): Promise<void> {
  await syslog({
    type: 'follow_up',
    severity: 'warn',
    message: `Circuit breaker aberto — sequência ${sequenceId} pausada por 30 min`,
    company_id: companyId,
    payload: { sequenceId },
  })
}

async function registrarExecucaoTrial(
  trialId: number,
  sequenceId: string,
  stepId: string,
  companyId: number,
  status: 'sent' | 'failed' | 'skipped' | 'dlq',
  supabase: Supabase
): Promise<void> {
  await supabase.from('follow_executions').insert({
    trial_id: trialId,
    sequence_id: sequenceId,
    step_id: stepId,
    company_id: companyId,
    status,
  })
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
  status: 'sent' | 'failed' | 'skipped' | 'dlq',
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
  const isRemarketing = sequence.tipo === 'remarketing'
  const tentativa = (step.ordem ?? 0) + 1

  const systemParts = [
    'Você é um assistente de follow-up de vendas. Gere uma mensagem curta, natural e humana para retomar contato.',
    'Regras: máximo 2-3 linhas, tom amigável sem pressão, não mencione tempo sem resposta, use o contexto disponível.',
    `Contexto do lead:\n- Nome: ${lead.contact_name}\n- Status: ${lead.status}\n- Resumo: ${lead.resumo_ia ?? 'sem histórico'}\n- Sequência: ${sequence.nome} (${sequence.tipo})`,
  ]

  if (isRemarketing && lead.resumo_ia) {
    const angulo = tentativa === 1
      ? 'valor — reforce o benefício principal da solução com base no que o lead demonstrou interesse'
      : tentativa === 2
      ? 'prova social — mencione resultados reais ou casos similares ao perfil do lead (use o que souber do contexto, sem inventar)'
      : 'encerramento — última tentativa, crie senso de escassez ou deixe a porta aberta de forma respeitosa'

    systemParts.push(`
CONTEXTO DE REMARKETING — TENTATIVA #${tentativa}:
Antes de escrever, analise internamente o resumo do lead e identifique:
1. Temperatura: quente (alto interesse, quase fechou), morno (interesse mas hesitante) ou frio (pouco engajamento)
2. Última objeção ou barreira mencionada (preço, timing, dúvida técnica, etc.)

REGRAS PARA ESTA MENSAGEM:
- Ângulo desta tentativa: ${angulo}
- Se identificou uma objeção clara, endereçe-a diretamente — não ignore
- Leads quentes: tom de urgência/FOMO sutil. Leads mornos: reforço de valor. Leads frios: reengajamento leve sem pressão
- NÃO mencione que é um follow-up ou tentativa de remarketing
- NÃO repita o mesmo ângulo das tentativas anteriores`)
  }

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

function formatOffsetLabel(dia_offset: number, offsetUnit: string | undefined): string {
  const totalMins = offsetUnit === 'minutes' ? dia_offset : Math.round(dia_offset * 60)
  if (totalMins === 0) return 'Na call'
  const abs = Math.abs(totalMins)
  const h = Math.floor(abs / 60)
  const m = abs % 60
  const suffix = totalMins < 0 ? 'antes' : 'pós'
  if (h === 0) return `${m}min ${suffix}`
  if (m === 0) return `${h}h ${suffix}`
  return `${h}h ${m}min ${suffix}`
}

async function gravarMensagemFollow(
  leadId: number,
  companyId: number,
  phone: string,
  text: string,
  tipo: string,
  supabase: Supabase,
  tipoMensagem: StepTipoMensagem = 'text',
  media?: StepMediaConfig | null,
  nomeAgente = 'Follow-up SDR'
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
    nome_do_agente: nomeAgente,
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
        urlMidia = JSON.stringify({ menuType: media.menuType ?? 'button', choices: media.choices, button_actions: media.button_actions ?? {} })
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

    // Staging mode — skip real sends (dry-run only)
    const isStaging = sequence.staging === true

    const expiraDias = (sequence.canvas_config as any)?.expira_em_dias ?? 0
    const eventoEntrada = sequence.canvas_config?.eventoEntrada

    // ── Graph traversal setup ──
    const { adj: graphAdj, entryId: graphEntry } = buildGraphAdj(steps as FollowStep[], sequence.canvas_config as any)
    const hasGraph = (sequence.canvas_config as any)?.edges?.length > 0

    // Batch-load all fired executions for this sequence (avoids N+1 per lead)
    const { data: seqExecs } = await supabase
      .from('follow_executions')
      .select('lead_id, step_id')
      .eq('sequence_id', sequence.id)
      .in('status', ['sent', 'skipped', 'dlq'])

    const firedByLead = new Map<number, Set<string>>()
    for (const ex of seqExecs ?? []) {
      if (!firedByLead.has(ex.lead_id)) firedByLead.set(ex.lead_id, new Set())
      firedByLead.get(ex.lead_id)!.add(ex.step_id)
    }

    // Hot leads first (call_de_venda, Interessado)
    const sortedLeads = [...((leads ?? []) as Lead[])].sort((a, b) => leadPriority(b) - leadPriority(a))

    for (const step of steps as FollowStep[]) {
      const unit = (step.media_config as any)?.offset_unit === 'hours' ? 'hours' : 'days'
      const msPerUnit = unit === 'hours' ? 3_600_000 : 86_400_000
      const cutoff = new Date(Date.now() - step.dia_offset * msPerUnit)

      for (const lead of sortedLeads) {
        if (!(await withinRateLimit(company.id, supabase))) return sent

        let leadFired = firedByLead.get(lead.id)
        if (!leadFired) { leadFired = new Set<string>(); firedByLead.set(lead.id, leadFired) }

        // ── Graph reachability gate ──
        if (hasGraph) {
          const reachable = await isStepReachableFromGraph(step.id, graphEntry, graphAdj, leadFired, steps as FollowStep[], lead, company.id, supabase)
          if (!reachable) continue
        }

        if (leadFired.has(step.id)) continue  // already dispatched

        // ── Non-blocking node types — execute immediately, no timing anchor needed ──
        if ((step.tipo_mensagem as string) === 'fim') {
          await registrarExecucao(lead.id, sequence.id, step.id, company.id, 'sent', supabase)
          leadFired.add(step.id)
          continue
        }
        if ((step.tipo_mensagem as string) === 'condicao') {
          try {
            await registrarExecucao(lead.id, sequence.id, step.id, company.id, 'sent', supabase)
            leadFired.add(step.id)
          } catch {
            await registrarExecucao(lead.id, sequence.id, step.id, company.id, 'failed', supabase)
          }
          continue
        }

        if (await leadJaRespondeuDesde(lead.id, company.id, cutoff, supabase)) continue

        // For novo_lead sequences, anchor timing to lead.created_at; otherwise use last inbound message
        let anchorDate: Date | null = null
        if (eventoEntrada === 'novo_lead') {
          const { data: leadRow } = await supabase
            .from('leads').select('created_at').eq('id', lead.id).maybeSingle()
          anchorDate = leadRow?.created_at ? new Date(leadRow.created_at) : null
        } else {
          const { data: ultimaMsg } = await supabase
            .from('mensagens_do_whatsapp')
            .select('created_at')
            .eq('id_do_lead', lead.id)
            .eq('direcao', 'inbound')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
          anchorDate = ultimaMsg?.created_at ? new Date(ultimaMsg.created_at) : null
        }

        if (!anchorDate) continue
        const elapsed = (Date.now() - anchorDate.getTime()) / msPerUnit
        if (elapsed < step.dia_offset) continue

        // ── Sequence expiry ──
        if (expiraDias > 0) {
          const { data: firstExec } = await supabase
            .from('follow_executions').select('disparado_em')
            .eq('lead_id', lead.id).eq('sequence_id', sequence.id)
            .order('disparado_em', { ascending: true }).limit(1).maybeSingle()
          if (firstExec?.disparado_em && (Date.now() - new Date(firstExec.disparado_em).getTime()) / 86_400_000 > expiraDias) continue
        }

        // ── Retry / DLQ ──
        const retryStatus = await checkRetry(lead.id, step.id, supabase)
        if (retryStatus === 'dlq') { await registrarExecucao(lead.id, sequence.id, step.id, company.id, 'dlq', supabase); continue }
        if (retryStatus === 'backoff') continue

        // ── Circuit breaker ──
        if (await isCircuitOpen(sequence.id)) continue

        // ── Fatigue guard ──
        if (await isFatigued(company.id, lead.id)) continue

        // ── Best time soft filter (deferralss to lead's preferred reply hour) ──
        const bestHour = await getBestSendHour(company.id, lead.id, supabase)
        if (bestHour !== null) {
          const nowBrtHour = new Date(Date.now() - 3 * 3_600_000).getUTCHours()
          const diff = Math.min(Math.abs(nowBrtHour - bestHour), 24 - Math.abs(nowBrtHour - bestHour))
          if (diff > 2) continue  // wait for better send window
        }

        const phone = normalizePhone(lead.whatsapp)
        const tipo = step.tipo_mensagem ?? 'text'
        const media = step.media_config

        // ── Exactly-once lock ──
        const lockKey = sendLockKey(company.id, lead.id, step.id)
        if (!(await acquireSendLock(lockKey))) continue

        // ── Sentiment step — classifica última mensagem via IA, armazena em Redis ──
        if (tipo === 'sentiment') {
          try {
            const { data: lastMsg } = await supabase
              .from('mensagens_do_whatsapp')
              .select('texto_da_mensagem')
              .eq('id_do_lead', lead.id)
              .eq('direcao', 'inbound')
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle()

            if (lastMsg?.texto_da_mensagem) {
              const completion = await openai.chat.completions.create({
                model: 'gpt-4.1-mini',
                messages: [
                  { role: 'system', content: 'Você é um classificador de sentimento. Responda exatamente com uma palavra: "positivo", "negativo" ou "neutro".' },
                  { role: 'user', content: lastMsg.texto_da_mensagem },
                ],
                max_tokens: 5,
                temperature: 0,
              })
              const sentiment = completion.choices[0]?.message?.content?.trim().toLowerCase() ?? 'neutro'
              try { await getRedis().set(`follow:sentiment:${company.id}:${lead.id}`, sentiment, 'EX', 24 * 3600) } catch {}
            }
            await registrarExecucao(lead.id, sequence.id, step.id, company.id, 'sent', supabase)
          } catch {
            await registrarExecucao(lead.id, sequence.id, step.id, company.id, 'failed', supabase)
          } finally {
            await releaseSendLock(lockKey)
          }
          continue
        }

        // ── Goal step — marca lead como convertido, sem envio ──
        if (tipo === 'goal') {
          try {
            const targetStatus = step.condicao || 'Convertido'
            await supabase.from('leads').update({ status: targetStatus, updated_at: new Date().toISOString() }).eq('id', lead.id)
            await registrarExecucao(lead.id, sequence.id, step.id, company.id, 'sent', supabase)
            leadFired.add(step.id)
          } catch {
            await registrarExecucao(lead.id, sequence.id, step.id, company.id, 'failed', supabase)
          } finally {
            await releaseSendLock(lockKey)
          }
          continue
        }

        // ── Sub-flow step — enrola lead na sequência referenciada ──
        if (tipo === 'sub_flow') {
          try {
            const subSeqId = (media as any)?.subSequenceId as string | undefined
            if (subSeqId) {
              const { data: subSeq } = await supabase
                .from('follow_sequences').select('id, ativo').eq('id', subSeqId).maybeSingle()
              if (subSeq?.ativo) {
                // Mark first step of sub-sequence as pending by NOT recording any execution —
                // the sub-sequence cron will pick it up naturally since no executions exist yet.
                // We only record this enrollment step as sent.
                await syslog({
                  type: 'follow_up', severity: 'info',
                  message: `Sub-flow enrollment — lead=${lead.id} → sequence=${subSeqId}`,
                  company_id: company.id,
                  payload: { leadId: lead.id, subSeqId },
                })
              }
            }
            await registrarExecucao(lead.id, sequence.id, step.id, company.id, 'sent', supabase)
          } catch {
            await registrarExecucao(lead.id, sequence.id, step.id, company.id, 'failed', supabase)
          } finally {
            await releaseSendLock(lockKey)
          }
          continue
        }

        // ── WaitEvent step — gating: avança só se lead respondeu com padrão desde última execução ──
        if (tipo === 'wait_event') {
          const event = (media as any)?.event as string | undefined
          const pattern = (media as any)?.pattern as string | undefined
          const { data: lastExec } = await supabase
            .from('follow_executions')
            .select('disparado_em')
            .eq('lead_id', lead.id)
            .eq('sequence_id', sequence.id)
            .eq('status', 'sent')
            .order('disparado_em', { ascending: false })
            .limit(1)
            .maybeSingle()
          const since = lastExec?.disparado_em ? new Date(lastExec.disparado_em) : new Date(Date.now() - 7 * 86_400_000)
          let matched = false
          if (pattern && event === 'keyword') {
            const { data: msgs } = await supabase
              .from('mensagens_do_whatsapp')
              .select('texto_da_mensagem')
              .eq('id_do_lead', lead.id)
              .eq('company_id', company.id)
              .eq('direcao', 'inbound')
              .gte('created_at', since.toISOString())
            matched = (msgs ?? []).some((m) =>
              m.texto_da_mensagem?.toLowerCase().includes(pattern.toLowerCase())
            )
          } else {
            matched = await leadJaRespondeuDesde(lead.id, company.id, since, supabase)
          }
          if (matched) {
            await registrarExecucao(lead.id, sequence.id, step.id, company.id, 'sent', supabase)
          }
          await releaseSendLock(lockKey)
          continue
        }

        // ── Scheduling step ──
        if (tipo === 'agendamento') {
          try {
            const redis = getRedis()
            const schedKey = `canvas:sched:${company.id}:${phone}`
            const schedData = JSON.stringify({ duracao: media?.duracao ?? 60, sequenceId: sequence.id })
            await redis.set(schedKey, schedData, 'EX', 7 * 24 * 3600)

            const msgAbertura = media?.mensagemInicial
              ? substituirVariaveis(media.mensagemInicial as string, lead)
              : substituirVariaveis(`Oi {nome}! Que tal agendarmos uma call? Que dia e horário funciona pra você? 😊`, lead)

            await enviarMensagem(phone, msgAbertura, company, 'text', null)
            await gravarMensagemFollow(lead.id, company.id, phone, msgAbertura, 'follow_geral', supabase, 'text', null)
            await registrarExecucao(lead.id, sequence.id, step.id, company.id, 'sent', supabase)
            await recordCircuitSuccess(sequence.id)
            await recordFatigue(company.id, lead.id)
            sent++
          } catch {
            await registrarExecucao(lead.id, sequence.id, step.id, company.id, 'failed', supabase)
            const { shouldOpen } = await recordCircuitFailure(sequence.id)
            if (shouldOpen) await openCircuit(sequence.id, company.id, supabase)
          } finally {
            await releaseSendLock(lockKey)
          }
          continue
        }

        const textoRaw = step.usar_ia
          ? await gerarMensagemIA(lead, step, sequence, openai, company.sdr_prompt)
          : pickMessage(step)
        const texto = substituirVariaveis(textoRaw, lead)

        const precisaTexto = tipo === 'text' || step.usar_ia
        if (precisaTexto && !texto) {
          await releaseSendLock(lockKey)
          await registrarExecucao(lead.id, sequence.id, step.id, company.id, 'skipped', supabase)
          continue
        }

        try {
          if (isStaging) {
            // Staging: log intent without sending real WhatsApp message
            console.log(`[follow][staging] skip send — lead=${lead.id} seq=${sequence.id} step=${step.id} tipo=${tipo} msg="${texto.slice(0, 80)}"`)
          } else {
            await enviarMensagem(phone, texto, company, tipo, media)
            await gravarMensagemFollow(lead.id, company.id, phone, texto, 'follow_geral', supabase, tipo as StepTipoMensagem, media)

            const blocos: string[] = Array.isArray(media?.blocos) ? (media.blocos as string[]) : []
            for (let i = 1; i < blocos.length; i++) {
              const bloco = substituirVariaveis(blocos[i] || '', lead)
              if (!bloco) continue
              await new Promise((r) => setTimeout(r, 1000 + Math.random() * 1000))
              await enviarMensagem(phone, bloco, company, 'text', null)
              await gravarMensagemFollow(lead.id, company.id, phone, bloco, 'follow_geral', supabase, 'text', null)
            }
          }

          await registrarExecucao(lead.id, sequence.id, step.id, company.id, 'sent', supabase)
          leadFired.add(step.id)
          await recordCircuitSuccess(sequence.id)
          if (!isStaging) {
            await recordFatigue(company.id, lead.id)
            sent++
            await antiBanDelay()
          }
        } catch {
          await registrarExecucao(lead.id, sequence.id, step.id, company.id, 'failed', supabase)
          const { shouldOpen } = await recordCircuitFailure(sequence.id)
          if (shouldOpen) await openCircuit(sequence.id, company.id, supabase)
        } finally {
          await releaseSendLock(lockKey)
        }
      }
    }
  }

  return sent
}

async function processAntiNoshow(
  company: CompanyCtx,
  sequences: FollowSequence[],
  supabase: Supabase,
  opts: { force?: boolean; horasAlvo?: number; skipDelay?: boolean } = {}
): Promise<number> {
  let sent = 0
  const now = Date.now()
  const { force = false, horasAlvo, skipDelay = false } = opts

  const { data: leads } = await supabase
    .from('leads')
    .select('id, company_id, contact_name, whatsapp, status, resumo_ia, notes, call_de_venda, call_agendada_para, call_status, meet_url')
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
      const callTime = parseBrt(lead.call_agendada_para).getTime()

      for (const step of steps as FollowStep[]) {
        if (!(await withinRateLimit(company.id, supabase))) return sent
        if (await stepJaDisparado(lead.id, step.id, supabase)) continue

        // dia_offset: 'minutes' = minutos inteiros | 'hours'/legacy = horas decimais
        const offsetUnit = (step.media_config as any)?.offset_unit
        const offsetMs = offsetUnit === 'minutes'
          ? step.dia_offset * 60_000
          : step.dia_offset * 3_600_000
        const targetTime = callTime + offsetMs
        const diff = Math.abs(now - targetTime)

        if (force) {
          // Se horasAlvo especificado, só nodes com dia_offset próximo (±1h)
          if (horasAlvo !== undefined && Math.abs(step.dia_offset - horasAlvo) > 1) continue
        } else {
          // Janela assimétrica: dispara quando target passou (tolerância 2 min antes) até 15 min depois
          // Evita disparar cedo para steps pequenos (ex: 5min pós call)
          if (targetTime > now + 2 * 60_000) continue   // ainda não chegou a hora
          if (targetTime < now - 15 * 60_000) continue  // janela expirou (já rodou ou perdeu o ciclo)
        }

        // ── Retry / DLQ ──
        const retryStatus = await checkRetry(lead.id, step.id, supabase)
        if (retryStatus === 'dlq') { await registrarExecucao(lead.id, sequence.id, step.id, company.id, 'dlq', supabase); continue }
        if (retryStatus === 'backoff') continue

        // ── Circuit breaker ──
        if (await isCircuitOpen(sequence.id)) continue

        const phone = normalizePhone(lead.whatsapp)
        const tipo = step.tipo_mensagem ?? 'text'
        const media = step.media_config
        const texto = substituirVariaveis(pickMessage(step), lead)
        if (!texto) continue

        // ── Exactly-once lock ──
        const lockKey = sendLockKey(company.id, lead.id, step.id)
        if (!(await acquireSendLock(lockKey))) continue

        const nomeAgente = `Anti-Noshow • ${formatOffsetLabel(step.dia_offset, offsetUnit)}`

        try {
          await enviarMensagem(phone, texto, company, tipo, media)
          await gravarMensagemFollow(lead.id, company.id, phone, texto, 'anti_noshow', supabase, tipo as StepTipoMensagem, media, nomeAgente)

          // Blocos adicionais (bloco[0] já foi enviado acima como texto principal)
          const blocos: string[] = Array.isArray(media?.blocos) ? (media.blocos as string[]) : []
          for (let i = 1; i < blocos.length; i++) {
            const bloco = substituirVariaveis(blocos[i] || '', lead)
            if (!bloco) continue
            await new Promise((r) => setTimeout(r, 1000 + Math.random() * 1500))
            await enviarMensagem(phone, bloco, company, 'text', null)
            await gravarMensagemFollow(lead.id, company.id, phone, bloco, 'anti_noshow', supabase, 'text', null, nomeAgente)
          }

          await registrarExecucao(lead.id, sequence.id, step.id, company.id, 'sent', supabase)
          await recordCircuitSuccess(sequence.id)
          sent++
          if (!force && !skipDelay) await antiBanDelay()
        } catch {
          await registrarExecucao(lead.id, sequence.id, step.id, company.id, 'failed', supabase)
          const { shouldOpen } = await recordCircuitFailure(sequence.id)
          if (shouldOpen) await openCircuit(sequence.id, company.id, supabase)
        } finally {
          await releaseSendLock(lockKey)
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
  skipDelay = false,
  force = false,
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
    .not('whatsapp', 'is', null)

  for (const sequence of sequences) {
    // Per-sequence remarketing criteria (configured in canvas trigger node)
    const rmCfg = sequence.canvas_config?.remarketing
    const statusFiltros: string[] = rmCfg?.statusFiltros?.length ? rmCfg.statusFiltros : ['Remarketing']
    const diasInativo = rmCfg?.diasInativo ?? 0

    // Extrai lead_id específico do nome (ex: "Remarketing — João [Lead #62]")
    const leadIdMatch = sequence.nome?.match(/\[Lead #(\d+)\]/)
    const targetLeadId = leadIdMatch ? parseInt(leadIdMatch[1]) : null

    const candidatos = (allLeads ?? []).filter((l: any) => statusFiltros.includes(l.status))

    const leads = targetLeadId
      ? candidatos.filter((l: any) => l.id === targetLeadId)
      : candidatos

    if (!leads.length) continue

    const { data: steps } = await supabase
      .from('follow_steps')
      .select('*')
      .eq('sequence_id', sequence.id)
      .order('ordem', { ascending: true })
    if (!steps?.length) continue

    // ── Graph traversal setup ──
    const { adj: rmAdj, entryId: rmEntry } = buildGraphAdj(steps as FollowStep[], sequence.canvas_config as any)
    const rmHasGraph = (sequence.canvas_config as any)?.edges?.length > 0

    // Batch-load all fired executions for this sequence
    const { data: rmExecs } = await supabase
      .from('follow_executions')
      .select('lead_id, step_id')
      .eq('sequence_id', sequence.id)
      .in('status', ['sent', 'skipped', 'dlq'])

    const rmFiredByLead = new Map<number, Set<string>>()
    for (const ex of rmExecs ?? []) {
      if (!rmFiredByLead.has(ex.lead_id)) rmFiredByLead.set(ex.lead_id, new Set())
      rmFiredByLead.get(ex.lead_id)!.add(ex.step_id)
    }

    // Controla leads que já tiveram um step disparado nesta execução — evita disparar N steps de uma vez
    const firedThisRun = new Set<number>()

    for (const step of steps as FollowStep[]) {
      // Só dispara se passou da hora configurada (cron roda a cada hora cheia)
      const [hh, mm] = (step.horario ?? '09:00').split(':').map(Number)
      const stepMinutes = hh * 60 + mm
      if (!force && nowMinutes < stepMinutes - 5) continue  // ainda não chegou a hora (5min tolerância)

      for (const lead of leads as unknown as Lead[]) {
        if (!force && firedThisRun.has(lead.id)) continue  // já disparou 1 step para este lead nesta rodada

        if (!(await withinRateLimit(company.id, supabase))) return sent

        let rmLeadFired = rmFiredByLead.get(lead.id)
        if (!rmLeadFired) { rmLeadFired = new Set<string>(); rmFiredByLead.set(lead.id, rmLeadFired) }

        // ── Graph reachability gate ──
        if (rmHasGraph) {
          const rmReachable = await isStepReachableFromGraph(step.id, rmEntry, rmAdj, rmLeadFired, steps as FollowStep[], lead, company.id, supabase)
          if (!rmReachable) continue
        }

        if (!force && rmLeadFired.has(step.id)) continue

        // ── End / Condition nodes — execute immediately, no timing anchor needed ──
        if ((step.tipo_mensagem as string) === 'fim') {
          await registrarExecucao(lead.id, sequence.id, step.id, company.id, 'sent', supabase)
          rmLeadFired.add(step.id)
          continue
        }
        if ((step.tipo_mensagem as string) === 'condicao') {
          try {
            await registrarExecucao(lead.id, sequence.id, step.id, company.id, 'sent', supabase)
            rmLeadFired.add(step.id)
          } catch {
            await registrarExecucao(lead.id, sequence.id, step.id, company.id, 'failed', supabase)
          }
          continue
        }

        // ── Retry / DLQ ──
        const retryStatusRm = await checkRetry(lead.id, step.id, supabase)
        if (retryStatusRm === 'dlq') { await registrarExecucao(lead.id, sequence.id, step.id, company.id, 'dlq', supabase); continue }
        if (!force && retryStatusRm === 'backoff') continue
        if (!force && await isCircuitOpen(sequence.id)) continue
        if (!force && await isFatigued(company.id, lead.id)) continue

        // Verifica inatividade mínima configurada no canvas (diasInativo)
        const rmUnit = (step.media_config as any)?.offset_unit === 'hours' ? 'hours' : 'days'
        const rmMs = rmUnit === 'hours' ? 3_600_000 : 86_400_000
        const movedAt = new Date((lead as any).updated_at ?? now).getTime()
        const elapsedRm = (now - movedAt) / rmMs
        // diasInativo = guard adicional; dia_offset = delay por step
        if (!force && diasInativo > 0 && elapsedRm < diasInativo) continue
        if (!force && elapsedRm < step.dia_offset) continue

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
        const lockKeyRm = sendLockKey(company.id, lead.id, step.id)
        if (!(await acquireSendLock(lockKeyRm))) continue

        try {
          await enviarMensagem(phone, texto, company, tipo, media)
          await gravarMensagemFollow(lead.id, company.id, phone, texto, 'remarketing', supabase, tipo as StepTipoMensagem, media)

          const blocosRm: string[] = Array.isArray(media?.blocos) ? (media.blocos as string[]) : []
          for (let i = 1; i < blocosRm.length; i++) {
            const bloco = substituirVariaveis(blocosRm[i] || '', lead)
            if (!bloco) continue
            await new Promise((r) => setTimeout(r, 1000 + Math.random() * 1500))
            await enviarMensagem(phone, bloco, company, 'text', null)
            await gravarMensagemFollow(lead.id, company.id, phone, bloco, 'remarketing', supabase, 'text', null)
          }

          await registrarExecucao(lead.id, sequence.id, step.id, company.id, 'sent', supabase)
          rmLeadFired.add(step.id)
          await recordCircuitSuccess(sequence.id)
          await recordFatigue(company.id, lead.id)
          sent++
          if (!skipDelay) await antiBanDelay()
        } catch {
          await registrarExecucao(lead.id, sequence.id, step.id, company.id, 'failed', supabase)
          const { shouldOpen: rmOpen } = await recordCircuitFailure(sequence.id)
          if (rmOpen) await openCircuit(sequence.id, company.id, supabase)
        } finally {
          await releaseSendLock(lockKeyRm)
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

        // ── Retry / DLQ ──
        const retryStatusProp = await checkRetry(lead.id, step.id, supabase)
        if (retryStatusProp === 'dlq') { await registrarExecucao(lead.id, sequence.id, step.id, company.id, 'dlq', supabase); continue }
        if (retryStatusProp === 'backoff') continue
        if (await isCircuitOpen(sequence.id)) continue
        if (await isFatigued(company.id, lead.id)) continue

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

        const lockKeyProp = sendLockKey(company.id, lead.id, step.id)
        if (!(await acquireSendLock(lockKeyProp))) continue

        try {
          await enviarMensagem(phone, texto, company, tipo, media)
          await gravarMensagemFollow(lead.id, company.id, phone, texto, 'follow_proposta', supabase, tipo as StepTipoMensagem, media)
          await registrarExecucao(lead.id, sequence.id, step.id, company.id, 'sent', supabase)
          await recordCircuitSuccess(sequence.id)
          await recordFatigue(company.id, lead.id)
          sent++
          await antiBanDelay()
        } catch {
          await registrarExecucao(lead.id, sequence.id, step.id, company.id, 'failed', supabase)
          const { shouldOpen: propOpen } = await recordCircuitFailure(sequence.id)
          if (propOpen) await openCircuit(sequence.id, company.id, supabase)
        } finally {
          await releaseSendLock(lockKeyProp)
        }
      }
    }
  }

  return sent
}

async function processTrialSaas(
  company: CompanyCtx,
  sequences: FollowSequence[],
  supabase: Supabase,
  onlyTrialId?: number,
  immediate = false
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

  let trialsQuery = supabase
    .from('saas_trials')
    .select('id, company_id, nome, whatsapp, status, criado_em, trial_days, respondeu, estagio')
    .eq('company_id', company.id)
    .eq('status', 'ativo')
    .not('whatsapp', 'is', null)
  if (onlyTrialId) trialsQuery = trialsQuery.eq('id', onlyTrialId)
  const { data: trials } = await trialsQuery

  for (const sequence of sequences) {
    const { data: steps } = await supabase
      .from('follow_steps')
      .select('*')
      .eq('sequence_id', sequence.id)
      .order('ordem', { ascending: true })
    if (!steps?.length) continue

    // Usa BRT (UTC-3) — canvas configura horários em BRT, servidor roda em UTC
    const nowBRT = new Date(now - 3 * 3_600_000)
    const nowMinutes = nowBRT.getUTCHours() * 60 + nowBRT.getUTCMinutes()
    const firedThisRunTrial = new Set<number>()

    for (const trial of (trials ?? []) as TrialSaas[]) {
      const signupTime = new Date(trial.criado_em).getTime()
      const daysSinceSignup = (now - signupTime) / 86_400_000

      // Skip expired trials (trial_days + 1 day grace)
      if (daysSinceSignup > (trial.trial_days ?? 7) + 1) continue

      const brtDate = new Date(now - 3 * 3_600_000)
      const brtTime = `${brtDate.getUTCHours().toString().padStart(2, '0')}:${brtDate.getUTCMinutes().toString().padStart(2, '0')}h`
      console.log(`[trial] #${trial.id} "${trial.nome}" D${Math.floor(daysSinceSignup)} @ ${brtTime} (${daysSinceSignup.toFixed(3)}d)`)

      const confirmedDispatched = new Set<string>()
      let firedThisRunCount = 0

      for (const step of steps as FollowStep[]) {
        // Só 1 step por trial por rodada — webhook dispara step1 e para; cron avança 1 por vez
        if (firedThisRunTrial.has(trial.id)) { firedThisRunCount++; continue }

        if (!(await withinRateLimit(company.id, supabase))) return sent
        if (await stepJaDisparadoTrial(trial.id, step.id, supabase)) {
          confirmedDispatched.add(step.id)
          continue  // já enviado — silencioso
        }

        // ── Retry / DLQ ──
        const retryStatusTrial = await checkRetry(trial.id, step.id, supabase, true)
        if (retryStatusTrial === 'dlq') {
          await registrarExecucaoTrial(trial.id, sequence.id, step.id, company.id, 'dlq', supabase)
          console.log(`[trial] #${trial.id} step=${step.id.slice(0,8)} → DLQ (max retries atingido)`)
          continue
        }
        if (retryStatusTrial === 'backoff') { console.log(`[trial] #${trial.id} step=${step.id.slice(0,8)} → backoff (aguardando retry)`); continue }
        const trialCircuitKey = `${sequence.id}:${trial.id}`
        if (await isCircuitOpen(trialCircuitKey)) { console.log(`[trial] #${trial.id} step=${step.id.slice(0,8)} → circuit open (falhas consecutivas)`); continue }

        // Nós de controle (condicao/fim) — só disparam após todos os steps de mensagem anteriores concluírem
        if ((step.tipo_mensagem as string) === 'fim' || (step.tipo_mensagem as string) === 'condicao') {
          const priorMsgSteps = (steps as FollowStep[]).filter(
            s => s.ordem < step.ordem &&
                 (s.tipo_mensagem as string) !== 'fim' &&
                 (s.tipo_mensagem as string) !== 'condicao'
          )
          if (!priorMsgSteps.every(s => confirmedDispatched.has(s.id))) {
            const pendentes = priorMsgSteps
              .filter(s => !confirmedDispatched.has(s.id))
              .map(s => s.horario ?? '?')
            console.log(`[trial] #${trial.id} nó-controle ${step.id.slice(0,8)} → aguardando predecessores: [${pendentes.join(', ')}]`)
            continue
          }
          await registrarExecucaoTrial(trial.id, sequence.id, step.id, company.id, 'sent', supabase)
          confirmedDispatched.add(step.id)
          console.log(`[trial] #${trial.id} nó-controle ${step.id.slice(0,8)} ✓ processado`)
          continue  // nós de controle não contam como disparo — não bloqueia próximos steps
        }

        const trialUnit = (step.media_config as any)?.offset_unit === 'hours' ? 'hours' : 'days'
        const trialElapsed = trialUnit === 'hours'
          ? (now - signupTime) / 3_600_000
          : daysSinceSignup
        if (trialElapsed < step.dia_offset) {
          console.log(`[trial] #${trial.id} step=${step.id.slice(0,8)} → aguarda D${step.dia_offset} (hoje D${Math.floor(trialElapsed)})`)
          continue
        }

        // Verifica horário configurado no step (ex: 19:30)
        const [hh, mm] = (step.horario ?? '09:00').split(':').map(Number)
        const stepMinutes = hh * 60 + mm
        if (!immediate && nowMinutes < stepMinutes) {
          console.log(`[trial] #${trial.id} step=${step.id.slice(0,8)} → aguarda ${toHHMM(stepMinutes)} D${step.dia_offset} (agora ${toHHMM(nowMinutes)})`)
          continue
        }

        // D0 com horário definido: se passou mais de 2h, o step expirou — SOMENTE se o trial
        // já existia quando o step deveria ter disparado (signupMinutes < stepMinutes).
        if (!immediate && trialUnit === 'days' && step.dia_offset === 0 && stepMinutes > 0) {
          const minutesLate = nowMinutes - stepMinutes
          const signupDate = new Date(signupTime)
          const signupMinutes = signupDate.getHours() * 60 + signupDate.getMinutes()
          if (minutesLate > 120 && signupMinutes < stepMinutes) {
            console.log(`[trial] #${trial.id} step=${step.id.slice(0,8)} → EXPIRADO (${minutesLate}min atrasado, cadastro foi ${toHHMM(signupMinutes)})`)
            await registrarExecucaoTrial(trial.id, sequence.id, step.id, company.id, 'skipped', supabase)
            confirmedDispatched.add(step.id)
            continue
          }
        }

        // Checa condição do step — steps pulados por condição contam como "concluídos"
        // para que nós fim/condicao subsequentes (merge) não fiquem travados
        const condicao = step.condicao ?? 'sempre'
        if (condicao === 'respondeu' && !trial.respondeu) { confirmedDispatched.add(step.id); continue }
        if (condicao === 'sem_resposta' && trial.respondeu) { confirmedDispatched.add(step.id); continue }

        // Roteamento por estágio (qual botão o lead clicou)
        if (step.condicao_estagio) {
          if (trial.estagio !== step.condicao_estagio) {
            confirmedDispatched.add(step.id)
            console.log(`[trial] #${trial.id} step=${step.id.slice(0,8)} → branch ignorado (estagio="${trial.estagio}" ≠ "${step.condicao_estagio}")`)
            continue
          }
        }

        console.log(`[trial] #${trial.id} "${trial.nome}" → ENVIANDO step ${step.id.slice(0,8)} @ ${step.horario ?? '??'} D${step.dia_offset}`)

        const phone = testPhone ?? normalizePhone(trial.whatsapp)
        const tipo = step.tipo_mensagem ?? 'text'
        const textoRaw = pickMessage(step)
        if (!textoRaw && tipo === 'text') {
          console.log(`[trial] #${trial.id} step=${step.id.slice(0,8)} → PULADO (mensagem vazia)`)
          await registrarExecucaoTrial(trial.id, sequence.id, step.id, company.id, 'skipped', supabase)
          confirmedDispatched.add(step.id)
          continue
        }
        const texto = substituirVariaveis(textoRaw ?? '', {
          contact_name: trial.nome, whatsapp: trial.whatsapp, status: trial.status,
          resumo_ia: null, notes: null, call_de_venda: null, call_agendada_para: null, call_status: null,
          id: trial.id, company_id: trial.company_id,
        })
        const media = step.media_config

        const lockKeyTrial = sendLockKey(company.id, trial.id, step.id)
        if (!(await acquireSendLock(lockKeyTrial))) {
          console.log(`[trial] #${trial.id} step=${step.id.slice(0,8)} → locked (duplo disparo bloqueado)`)
          continue
        }

        try {
          await enviarMensagem(phone, texto, company, tipo, media)
          await gravarMensagemTrial(trial.id, company.id, texto, 'trial_saas', supabase, phone, trial.nome, tipo, media)

          // Blocos adicionais
          const blocosTrial: string[] = Array.isArray(media?.blocos) ? (media.blocos as string[]) : []
          for (let i = 1; i < blocosTrial.length; i++) {
            const bloco = blocosTrial[i] || ''
            if (!bloco) continue
            await new Promise((r) => setTimeout(r, 1000 + Math.random() * 1500))
            await enviarMensagem(phone, bloco, company, 'text', null)
            await gravarMensagemTrial(trial.id, company.id, bloco, 'trial_saas', supabase, phone, trial.nome, 'text', null)
          }

          await registrarExecucaoTrial(trial.id, sequence.id, step.id, company.id, 'sent', supabase)
          firedThisRunTrial.add(trial.id)
          confirmedDispatched.add(step.id)
          console.log(`[trial] #${trial.id} "${trial.nome}" ✅ ENVIADO step ${step.id.slice(0,8)} @ ${step.horario ?? '??'} D${step.dia_offset}`)

          if (step.sdr_ativo !== null && step.sdr_ativo !== undefined) {
            const phoneVars = phoneVariants(phone)
            const { data: conv } = await supabase
              .from('conversas_do_whatsapp')
              .select('id')
              .eq('company_id', company.id)
              .in('numero_de_telefone', phoneVars)
              .order('hora_da_ultima_mensagem', { ascending: false })
              .limit(1)
              .maybeSingle()

            if (conv?.id) {
              await supabase.from('conversas_do_whatsapp')
                .update({ agente_pausado: !step.sdr_ativo })
                .eq('id', conv.id)

              if (step.sdr_ativo === true) {
                const dias = Math.floor((Date.now() - new Date(trial.criado_em).getTime()) / 86_400_000)
                const contexto = `[Trial SaaS] Lead em período de teste (D${dias}/${trial.trial_days}). Estágio: ${trial.estagio ?? 'não definido'}. SDR reativado pela sequência trial.`
                const { data: lead } = await supabase
                  .from('leads').select('id')
                  .eq('company_id', company.id)
                  .in('whatsapp', phoneVars)
                  .order('created_at', { ascending: false })
                  .limit(1)
                  .maybeSingle()
                if (lead?.id) {
                  await supabase.from('leads')
                    .update({ notes: contexto, updated_at: new Date().toISOString() })
                    .eq('id', lead.id)
                }
              }
            }
          }

          await recordCircuitSuccess(trialCircuitKey)
          sent++
          await antiBanDelay()
        } catch (err: any) {
          firedThisRunTrial.add(trial.id)
          await registrarExecucaoTrial(trial.id, sequence.id, step.id, company.id, 'failed', supabase)
          const { shouldOpen: trialOpen } = await recordCircuitFailure(trialCircuitKey)
          if (trialOpen) await openCircuit(trialCircuitKey, company.id, supabase)
          console.error(`[trial] #${trial.id} ❌ ERRO ao enviar step ${step.id.slice(0,8)}: ${err.message}`)
          await syslog({
            type: 'follow_up',
            severity: 'error',
            message: `Trial follow error: ${err.message}`,
            company_id: company.id,
            payload: { trial_id: trial.id, step_id: step.id, stack: err.stack?.slice(0, 500) },
          })
        } finally {
          await releaseSendLock(lockKeyTrial)
        }
      }

      // Resumo por trial: mostra próxima ação pendente
      const nextPending = (steps as FollowStep[]).find(s =>
        !confirmedDispatched.has(s.id) &&
        (s.tipo_mensagem as string) !== 'fim' &&
        (s.tipo_mensagem as string) !== 'condicao'
      )
      if (nextPending) {
        const [nh, nm] = (nextPending.horario ?? '09:00').split(':').map(Number)
        console.log(`[trial] #${trial.id} próxima msg: @ ${toHHMM(nh * 60 + nm)} D${nextPending.dia_offset}${firedThisRunCount > 0 ? ` (${firedThisRunCount} steps aguardando próxima rodada do cron)` : ''}`)
      } else if (firedThisRunCount === 0) {
        console.log(`[trial] #${trial.id} sequência completa`)
      }
    }
  }

  return sent
}

// ─── Entry point ─────────────────────────────────────────────────────────────

export async function runFollowUp(): Promise<{ processed: number; errors: string[] }> {
  const businessHours = isBusinessHours()

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

        // trial_saas roda sempre — cada step tem horário próprio configurado no canvas
        // follow_geral/remarketing/proposta só rodam em horário comercial
        const trialPromise = processTrialSaas(company, byTipo('trial_saas'), supabase)
        const otherPromises = businessHours
          ? [
              processFollowGeral(company, byTipo('follow_geral'), openai, supabase),
              processRemarketing(company, byTipo('remarketing'), openai, supabase),
              processFollowProposta(company, byTipo('follow_proposta'), openai, supabase),
            ]
          : [Promise.resolve(0), Promise.resolve(0), Promise.resolve(0)]

        const [t, g, r, p] = await Promise.allSettled([trialPromise, ...otherPromises])

        const total = [t, g, r, p]
          .filter((r) => r.status === 'fulfilled')
          .reduce((acc, r) => acc + (r as PromiseFulfilledResult<number>).value, 0)

        for (const result of [t, g, r, p]) {
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

/** Roda anti-noshow para todas as empresas ativas — usado pelo cron a cada 15 min */
export async function runAntNoshowAll(): Promise<{ processed: number; sent: number; errors: string[] }> {
  const supabase = createServiceClient()
  const platformCfg = await getPlatformConfig()
  const errors: string[] = []
  let processed = 0
  let totalSent = 0

  const { data: configs, error: cfgErr } = await supabase
    .from('sdr_configs')
    .select('company_id, uazapi_instance_url, uazapi_token, openai_key, prompt, agente_ativo')
    .eq('agente_ativo', true)

  if (cfgErr) return { processed: 0, sent: 0, errors: [cfgErr.message] }

  for (const cfg of configs ?? []) {
    try {
      const company: CompanyCtx = {
        id: cfg.company_id,
        uazapi_url: cfg.uazapi_instance_url ?? platformCfg.uazapi_base_url,
        uazapi_token: safeDecrypt(cfg.uazapi_token),
        openai_key: safeDecrypt(cfg.openai_key, platformCfg.openai_api_key),
        sdr_prompt: cfg.prompt ?? null,
      }
      if (!company.uazapi_token) { errors.push(`Empresa ${cfg.company_id}: token WhatsApp vazio`); continue }
      if (!(await isUazapiHealthy(company.id, company.uazapi_url, company.uazapi_token))) {
        errors.push(`Empresa ${cfg.company_id}: WhatsApp desconectado — anti-noshow pulado`)
        continue
      }

      const { data: sequences } = await supabase
        .from('follow_sequences')
        .select('*')
        .eq('company_id', company.id)
        .eq('tipo', 'anti_noshow')
        .eq('ativo', true)

      if (!sequences?.length) { processed++; continue }

      const sent = await processAntiNoshow(company, sequences as FollowSequence[], supabase)
      totalSent += sent
      processed++
    } catch (err: any) {
      errors.push(`Empresa ${cfg.company_id}: ${err.message}`)
    }
  }

  return { processed, sent: totalSent, errors }
}

export async function runAntNoshowForCompany(
  companyId: number,
  opts: { horasAlvo?: number } = {}
): Promise<{ sent: number; error?: string }> {
  const supabase = createServiceClient()
  const platformCfg = await getPlatformConfig()

  const { data: cfg } = await supabase
    .from('sdr_configs')
    .select('company_id, uazapi_instance_url, uazapi_token, openai_key, prompt, agente_ativo')
    .eq('company_id', companyId)
    .maybeSingle()

  if (!cfg) return { sent: 0, error: 'sdr_configs não encontrado para esta empresa' }

  const company: CompanyCtx = {
    id: cfg.company_id,
    uazapi_url: cfg.uazapi_instance_url ?? platformCfg.uazapi_base_url,
    uazapi_token: safeDecrypt(cfg.uazapi_token),
    openai_key: safeDecrypt(cfg.openai_key, platformCfg.openai_api_key),
    sdr_prompt: cfg.prompt ?? null,
  }
  if (!company.uazapi_token) return { sent: 0, error: 'Token WhatsApp não configurado' }

  const { data: sequences } = await supabase
    .from('follow_sequences')
    .select('*')
    .eq('company_id', companyId)
    .eq('tipo', 'anti_noshow')
    .eq('ativo', true)

  if (!sequences?.length) return { sent: 0, error: 'Nenhuma sequência Anti-Noshow ativa' }

  const sent = await processAntiNoshow(
    company,
    sequences as FollowSequence[],
    supabase,
    { force: true, horasAlvo: opts.horasAlvo, skipDelay: true }
  )
  return { sent }
}

export async function runRemarketingForCompany(companyId: number, skipDelay = false, force = false): Promise<{ sent: number; error?: string }> {
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

  const sent = await processRemarketing(company, sequences as FollowSequence[], openai, supabase, skipDelay, force)
  return { sent }
}

/** Dispara imediatamente o trial recém-criado — usado pelo webhook após upsert */
export async function runTrialSaasImmediate(companyId: number, trialId: number): Promise<{ sent: number; error?: string }> {
  const supabase = createServiceClient()
  const platformCfg = await getPlatformConfig()

  const { data: cfg } = await supabase
    .from('sdr_configs')
    .select('company_id, uazapi_instance_url, uazapi_token, openai_key, prompt, agente_ativo')
    .eq('company_id', companyId)
    .maybeSingle()

  if (!cfg) return { sent: 0, error: 'sdr_configs não encontrado' }

  const company: CompanyCtx = {
    id: cfg.company_id,
    uazapi_url: cfg.uazapi_instance_url ?? platformCfg.uazapi_base_url,
    uazapi_token: safeDecrypt(cfg.uazapi_token),
    openai_key: safeDecrypt(cfg.openai_key, platformCfg.openai_api_key),
    sdr_prompt: cfg.prompt ?? null,
  }
  if (!company.uazapi_token) return { sent: 0, error: 'Token WhatsApp não configurado' }

  const { data: sequences } = await supabase
    .from('follow_sequences')
    .select('*')
    .eq('company_id', companyId)
    .eq('tipo', 'trial_saas')
    .eq('ativo', true)

  if (!sequences?.length) return { sent: 0, error: 'Nenhuma sequência trial_saas ativa' }

  const sent = await processTrialSaas(company, sequences as FollowSequence[], supabase, trialId, true)
  return { sent }
}
