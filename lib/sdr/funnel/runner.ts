/**
 * Runner do funil : liga a máquina pura (machine.ts) ao mundo (banco, IA,
 * WhatsApp). Fluxo de um turno:
 *   carrega config + estado -> lê a mensagem (IA, JSON validado) -> máquina
 *   decide -> grava o estado -> executa as ações (enviar, passar pro humano...).
 *
 * Tudo que pode falhar ANTES de enviar algo é isolado : se der erro nessa fase,
 * o funil devolve handled=false e o motor antigo (orquestrador) atende o turno,
 * então uma falha do funil nunca deixa o lead sem resposta. Depois que algo foi
 * enviado, erros propagam (o worker tenta de novo), nunca cai pro orquestrador
 * pra não mandar resposta dupla.
 */
import type OpenAI from 'openai'
import type { createServiceClient } from '@/lib/supabase/server'
import { readMessage } from './reader'
import { answerFromKnowledge } from './box'
import { stepFunnel } from './machine'
import { detectAskedStep } from './sync'
import { assessLead, buildResumo, classifySegment, nextStatus } from './crm'
import { buildReaction, shouldReact } from './reaction'
import { initialState, type FunnelAction, type FunnelConfig, type FunnelState, type Reading, type StepResult } from './types'

type Supabase = ReturnType<typeof createServiceClient>

export interface FunnelDeps {
  supabase: Supabase
  openai: OpenAI
  /** Envia os textos ao lead (cada item vira uma mensagem), com atraso humano e dry-run do QA. */
  send: (texts: string[]) => Promise<void>
  /** Busca na base de conhecimento aprovada (RAG). */
  search: (question: string) => Promise<string>
  onUsage: (c: OpenAI.Chat.ChatCompletion, agent: string) => void
  log: (event: string, data: Record<string, unknown>) => Promise<void>
  /** Distribui a conversa na fila de atendimento humano. */
  distribute: () => Promise<unknown>
}

export interface FunnelTurnParams {
  companyId: number
  leadId: number
  leadName: string
  conversationId: string
  leadText: string
  deps: FunnelDeps
}

const REASON_LABEL: Record<string, string> = {
  lead_pediu_humano: 'pediu para falar com uma pessoa',
  lead_pediu_ligacao: 'pediu ligação',
  lead_quer_ligacao: 'quer receber uma ligação',
  preco_insistente: 'insistiu no preço',
  sem_resposta_na_base: 'fez perguntas que a base não responde',
  leitor_falhou: 'a leitura automática falhou repetidas vezes',
}

function reasonLabel(reason: string): string {
  if (REASON_LABEL[reason]) return REASON_LABEL[reason]
  if (reason.startsWith('objecao_esgotada')) return 'repetiu a mesma objeção'
  if (reason.startsWith('lead_nao_responde')) return 'não respondeu uma pergunta do roteiro depois de 3 tentativas'
  return reason
}

function parseConfig(raw: unknown): FunnelConfig | null {
  if (!raw || typeof raw !== 'object') return null
  const c = raw as Partial<FunnelConfig>
  if (c.version !== 1 || !Array.isArray(c.steps) || c.steps.length === 0) return null
  for (const s of c.steps) {
    if (!s || typeof s.id !== 'string' || typeof s.question !== 'string' || !Array.isArray(s.fields) || s.fields.length === 0) return null
  }
  if (!c.handoff || typeof c.handoff.waitMessage !== 'string') return null
  return {
    priceScripts: [],
    priceInsistHandoff: c.handoff.waitMessage,
    objections: {},
    maxObjections: 2,
    refusalReply: '',
    farewellReply: '',
    unknownAnswer: c.handoff.waitMessage,
    ...c,
  } as FunnelConfig
}

function loadState(raw: unknown): FunnelState | null {
  if (!raw || typeof raw !== 'object') return null
  const s = raw as Partial<FunnelState>
  if (s.v !== 1) return null
  return { ...initialState(), ...s } as FunnelState
}

function dataSummary(config: FunnelConfig, state: FunnelState): string {
  const labels = new Map(config.steps.flatMap((s) => s.fields.map((f) => [f.key, f.label] as const)))
  return Object.entries(state.data)
    .map(([k, v]) => `${labels.get(k) ?? k}: ${v}`)
    .join('; ')
}

/** Perguntas e respostas no formato que o orquestrador e o CRM já entendem. */
function qaPairs(config: FunnelConfig, state: FunnelState): { pergunta: string; resposta: string }[] {
  const out: { pergunta: string; resposta: string }[] = []
  for (const step of config.steps) {
    const answers = step.fields.filter((f) => state.data[f.key]).map((f) => `${f.label}: ${state.data[f.key]}`)
    if (answers.length === 0) continue
    out.push({ pergunta: step.question.replace(/\{nome\},?\s*/g, '').trim(), resposta: answers.join('; ') })
  }
  return out
}

async function persistChecklist(
  p: FunnelTurnParams,
  config: FunnelConfig,
  state: FunnelState,
  prev: Record<string, unknown> | null,
  extra: Record<string, unknown>
): Promise<void> {
  const checklist = {
    ...(prev ?? {}),
    apresentacao_feita: true,
    nome_perguntado: true,
    perguntas_e_respostas: qaPairs(config, state),
    ...extra,
  }
  await p.deps.supabase.from('conversas_do_whatsapp').update({ checklist_atendimento: checklist }).eq('id', p.conversationId)
}

async function notifyTeam(p: FunnelTurnParams, config: FunnelConfig, state: FunnelState, reason: string): Promise<void> {
  const resumo = dataSummary(config, state)
  const { error } = await p.deps.supabase.from('activity_logs').insert({
    company_id: p.companyId,
    action: 'sdr_handoff',
    description: `${p.leadName || 'Lead'} ${reasonLabel(reason)}.${resumo ? ` Dados coletados: ${resumo}.` : ''}`,
    metadata: { lead_id: p.leadId, conversation_id: p.conversationId, reason, data: state.data },
  })
  if (error) console.error(`[Funnel:${p.companyId}] activity_logs falhou:`, error.message)
}

async function execute(
  p: FunnelTurnParams,
  config: FunnelConfig,
  state: FunnelState,
  actions: FunnelAction[]
): Promise<void> {
  for (const action of actions) {
    if (action.type === 'send') {
      await p.deps.send(action.texts)
    } else if (action.type === 'handoff') {
      // Envia ANTES de pausar : o envio confere se a conversa está pausada e não manda se estiver.
      await p.deps.send(action.texts)
      await p.deps.supabase
        .from('conversas_do_whatsapp')
        .update({
          agente_pausado: true,
          agente_pausado_em: new Date().toISOString(),
          current_status: 'livre',
          kanban_stage: 'fila',
          queue_entered_at: new Date().toISOString(),
        })
        .eq('id', p.conversationId)
      await notifyTeam(p, config, state, action.reason)
      await p.deps.log('funnel_handoff', { reason: action.reason, data: state.data })
      p.deps.distribute().catch((e) => console.error(`[Funnel:${p.companyId}] distribuição pós-handoff falhou:`, e?.message))
    } else if (action.type === 'notify') {
      await notifyTeam(p, config, state, action.reason)
    }
    // silence, mark_refused e delegate_scheduling não têm efeito de envio aqui
  }
}

/**
 * Executa um turno do funil. handled=true : o turno foi resolvido aqui (o
 * motor NÃO deve chamar o orquestrador). handled=false : cai pro orquestrador
 * (funil desligado, conversa antiga sem estado, qualificação completa, ou falha
 * antes de enviar qualquer coisa).
 */
export async function runFunnelTurn(p: FunnelTurnParams): Promise<{ handled: boolean; leadName?: string }> {
  const { supabase, openai } = p.deps

  let config: FunnelConfig
  let result: StepResult
  let prevChecklist: Record<string, unknown> | null
  let reading: Reading
  let prevName: string | undefined
  let stageAtStart: FunnelState['stage'] = 'qualifying'

  try {
    const { data: cfgRow } = await supabase.from('sdr_funnel_configs').select('enabled, config').eq('company_id', p.companyId).maybeSingle()
    if (!cfgRow?.enabled) return { handled: false }
    const parsed = parseConfig(cfgRow.config)
    if (!parsed) {
      await p.deps.log('funnel_config_invalid', {})
      return { handled: false }
    }
    config = parsed

    const { data: conv } = await supabase
      .from('conversas_do_whatsapp')
      .select('funnel_state, checklist_atendimento')
      .eq('id', p.conversationId)
      .single()
    prevChecklist = (conv?.checklist_atendimento as Record<string, unknown> | null) ?? null

    // Conversa REAL (as duas pontas, por quem for): o estado do funil pode estar desatualizado
    // se uma pessoa assumiu no meio ou se mensagens chegaram durante uma pausa.
    const { data: recentRows, count } = await supabase
      .from('mensagens_do_whatsapp')
      .select('texto_da_mensagem, direcao, metadados', { count: 'exact' })
      .eq('id_da_conversacao', p.conversationId)
      .order('carimbo_de_data_e_hora', { ascending: false })
      .limit(14)
    const recent = (recentRows ?? []).filter((m) => (m.texto_da_mensagem ?? '').trim())
    const transcript = [...recent].reverse().map((m) => {
      // Áudio/imagem entram pelo conteúdo transcrito, não pelo rótulo do balão
      const transcricao = (m.metadados as { transcricao?: string } | null)?.transcricao
      const texto = transcricao ? `(por áudio ou imagem) ${transcricao}` : (m.texto_da_mensagem ?? '')
      return `${m.direcao === 'inbound' ? 'Lead' : 'Equipe'}: ${texto.replace(/\s+/g, ' ').slice(0, 400)}`
    })
    const outboundNewestFirst = recent.filter((m) => m.direcao === 'outbound').map((m) => m.texto_da_mensagem ?? '')

    const { count: outCount } = await supabase
      .from('mensagens_do_whatsapp')
      .select('id', { count: 'exact', head: true })
      .eq('id_da_conversacao', p.conversationId)
      .eq('direcao', 'outbound')
    const totalOutbound = outCount ?? count ?? 0

    const stored = loadState(conv?.funnel_state)
    // Conversa que já rodava no motor antigo (sem estado, mas com mensagens nossas) termina nele :
    // recomeçar o funil no meio repetiria apresentação e perguntas já feitas.
    if (!stored && totalOutbound > 0) return { handled: false }

    let state = stored ?? initialState()
    if (state.stage === 'scheduling') return { handled: false, leadName: state.data.nome }
    if (state.stage === 'handoff') {
      // Se chegou aqui, o humano devolveu a conversa pro SDR (conversa não está pausada).
      state = { ...state, stage: 'qualifying', asks: {}, objectionTurns: 0, priceAsked: 0, offScriptFails: 0, readerFailures: 0 }
    }
    // A pergunta pendente é a última pergunta do roteiro que foi de fato enviada (SDR ou pessoa).
    const askedStep = detectAskedStep(config, state, outboundNewestFirst)
    if (askedStep) state = { ...state, askedStep }
    prevName = state.data.nome
    stageAtStart = state.stage
    const isFirstTurn = totalOutbound === 0

    reading = await readMessage({ config, state, leadText: p.leadText, transcript, isFirstTurn }, openai, p.deps.onUsage)

    result = stepFunnel(config, state, reading, { isFirstTurn, leadText: p.leadText })
    if (result.needBox) {
      const boxAnswer = await answerFromKnowledge({ question: result.needBox, search: p.deps.search, openai, onUsage: p.deps.onUsage })
      result = stepFunnel(config, state, reading, { isFirstTurn, leadText: p.leadText, boxAnswer })
    }

    // Reação humana: quando o lead contou algo além da resposta seca, uma frase curta reconhece isso
    // antes da próxima pergunta. Opcional e à prova de falha: qualquer problema apaga a frase.
    if (shouldReact({ state: result.state, reading, actions: result.actions, isFirstTurn, enabled: config.reactions !== false })) {
      const rx = await buildReaction({
        transcript,
        leadText: p.leadText,
        lastQuestion: outboundNewestFirst[0] ?? '',
        recentOutbound: outboundNewestFirst,
        openai,
        onUsage: p.deps.onUsage,
      })
      await p.deps.log('funnel_reaction', { frase: rx.frase, aprovada: !!rx.texto, motivo: rx.motivo }).catch(() => {})
      if (rx.texto) {
        const envio = result.actions[0] as Extract<FunnelAction, { type: 'send' }>
        envio.texts = [rx.texto, ...envio.texts]
        result.state.reactionTurn = result.state.turns
      }
    }

    const extra: Record<string, unknown> = {}
    if (result.actions.some((a) => a.type === 'mark_refused')) extra.lead_recusou = true
    if (result.state.stage === 'scheduling') {
      extra.estagio_atual =
        'qualificacao_completa: todos os passos do roteiro foram respondidos. Ofereça o agendamento agora, chamando Agente_de_Agendamento direto, sem perguntar se pode.'
    }
    await persistChecklist(p, config, result.state, prevChecklist, extra)
    await supabase.from('conversas_do_whatsapp').update({ funnel_state: result.state }).eq('id', p.conversationId)

    // Nome confirmado pelo próprio lead (o campo só é aceito logo depois da pergunta de nome).
    if (result.state.data.nome && result.state.data.nome !== prevName) {
      await supabase.from('leads').update({ contact_name: result.state.data.nome, updated_at: new Date().toISOString() }).eq('id', p.leadId)
      await supabase.from('conversas_do_whatsapp').update({ nome_do_contato: result.state.data.nome }).eq('id', p.conversationId)
    }
  } catch (err: any) {
    console.error(`[Funnel:${p.companyId}] erro antes de enviar, caindo pro orquestrador:`, err)
    await p.deps.log('funnel_error', { message: err?.message ?? String(err) }).catch(() => {})
    return { handled: false }
  }

  await p.deps.log('funnel_turn', {
    categoria: reading.categoria,
    objecao: reading.objecaoTipo,
    confianca: reading.confianca,
    falhou: reading.falhou ?? false,
    dados: reading.dados,
    stage: result.state.stage,
    acoes: result.actions.map((a) => a.type),
  })

  if (result.actions.some((a) => a.type === 'delegate_scheduling')) {
    // Qualificação completa: antes de o agendamento (motor antigo) pedir dados, uma mensagem fixa
    // explica o que vai acontecer. Só sai uma vez (depois disso o estágio é 'scheduling').
    if (config.closingMessage?.trim()) {
      const nome = result.state.data.nome
      const text = nome ? config.closingMessage.replace(/\{nome\}/g, nome) : config.closingMessage.replace(/\{nome\},?\s*/g, '')
      await p.deps.send([text])
    }
    await syncLeadCrm(p, config, stageAtStart, result.state, result.actions)
    return { handled: false, leadName: result.state.data.nome }
  }

  await execute(p, config, result.state, result.actions)
  await syncLeadCrm(p, config, stageAtStart, result.state, result.actions)
  return { handled: true }
}

/**
 * Mantém o CRM do lead em dia (estágio, segmento, prioridade, temperatura, resumo).
 * Roda DEPOIS do envio e nunca derruba o atendimento : falha aqui só vira log.
 */
async function syncLeadCrm(
  p: FunnelTurnParams,
  config: FunnelConfig,
  stageAtStart: FunnelState['stage'],
  state: FunnelState,
  actions: FunnelAction[]
): Promise<void> {
  try {
    const { supabase, openai, onUsage } = p.deps
    const { data: lead } = await supabase
      .from('leads')
      .select('status, segment, resumo_ia')
      .eq('id', p.leadId)
      .single()
    if (!lead) return

    const upd: Record<string, unknown> = {}

    const resumo = buildResumo(config, state)
    if (resumo && resumo !== lead.resumo_ia) upd.resumo_ia = resumo

    const recusou = actions.some((a) => a.type === 'mark_refused')
    const alvo = recusou ? 'Perdido' : state.stage === 'scheduling' ? 'Interessado' : 'Em contato'
    const status = nextStatus(lead.status, alvo)
    if (status) upd.status = status

    if (!lead.segment && state.data.ramo) {
      const segmento = await classifySegment(state.data.ramo, openai, onUsage)
      if (segmento) upd.segment = segmento
    }

    // Prioridade e temperatura: uma vez, na virada de etapa (fim do roteiro, recusa ou passagem pra pessoa)
    if (state.stage !== stageAtStart) {
      const desfecho = recusou ? 'recusou' : state.stage === 'scheduling' ? 'qualificado' : state.stage === 'handoff' ? 'passou_para_pessoa' : null
      if (desfecho) {
        const av = await assessLead(resumo || '(sem dados coletados)', desfecho, openai, onUsage)
        if (av) {
          upd.priority = av.prioridade
          upd.nivel_interesse = av.temperatura
        }
      }
    }

    if (Object.keys(upd).length > 0) {
      await supabase.from('leads').update({ ...upd, updated_at: new Date().toISOString() }).eq('id', p.leadId)
      await p.deps.log('funnel_crm_sync', { campos: Object.keys(upd), status: upd.status ?? null, segmento: upd.segment ?? null })
    }
  } catch (err: any) {
    console.error(`[Funnel:${p.companyId}] atualização do CRM falhou (atendimento segue):`, err?.message)
  }
}
