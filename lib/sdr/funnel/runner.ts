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
import { splitOpening, stepFunnel } from './machine'
import { detectAskedStep } from './sync'
import { assessLead, buildResumo, classifySegment, nextStatus } from './crm'
import { buildEcho, buildReaction, leadVolunteered, shouldReact } from './reaction'
import { DEFAULT_AUDIO_FAIL_REPLY, isUnreadableAudio } from './audio'
import { enrichOutboundMedia, type MediaRow } from '../media-understanding'
import { buildFicha, humanizeScript } from './humanize'
import { runConversation } from './converse'
import { isRepeatOf } from '../output-guard'
import { buildMemory, countMessages, formatTranscript, MEMORY_MIN_MESSAGES, TRANSCRIPT_MAX_MESSAGES, type ConvRow, type Memoria } from './memory'
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
  /** A mensagem do lead traz áudio, imagem ou outra mídia (sempre respondida). */
  hasMedia?: boolean
  mediaKind?: 'audio' | 'imagem' | 'outro'
  deps: FunnelDeps
}

const REASON_LABEL: Record<string, string> = {
  lead_pediu_humano: 'pediu para falar com uma pessoa',
  lead_pediu_ligacao: 'pediu ligação',
  lead_pediu_algo_fora_do_alcance: 'pediu algo que o SDR não pode fazer (por exemplo um vídeo, uma prova ou falar com o dono)',
  conversa_longa: 'conversou fora do roteiro por vários turnos seguidos',
  lead_quer_ligacao: 'quer receber uma ligação',
  preco_insistente: 'insistiu no preço',
  sem_resposta_na_base: 'fez perguntas que a base não responde',
  leitor_falhou: 'a leitura automática falhou repetidas vezes',
}

function reasonLabel(reason: string): string {
  if (REASON_LABEL[reason]) return REASON_LABEL[reason]
  if (reason.startsWith('objecao_esgotada')) return 'repetiu a mesma objeção'
  if (reason.startsWith('lead_nao_responde')) return 'não respondeu uma pergunta do roteiro depois de 3 tentativas'
  if (reason.startsWith('conversa_sem_resposta_segura')) return 'está conversando fora do roteiro e o SDR não tinha uma resposta segura'
  if (reason === 'lead_nao_entende') return 'perguntou várias vezes do que se trata'
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

async function notifyTeam(p: FunnelTurnParams, config: FunnelConfig, state: FunnelState, reason: string, memoria?: Memoria | null): Promise<void> {
  const resumo = dataSummary(config, state)
  const contexto = memoria?.resumo ? ` Resumo da conversa: ${memoria.resumo}` : ''
  const { error } = await p.deps.supabase.from('activity_logs').insert({
    company_id: p.companyId,
    action: 'sdr_handoff',
    description: `${p.leadName || 'Lead'} ${reasonLabel(reason)}.${resumo ? ` Dados coletados: ${resumo}.` : ''}${contexto}`,
    metadata: { lead_id: p.leadId, conversation_id: p.conversationId, reason, data: state.data },
  })
  if (error) console.error(`[Funnel:${p.companyId}] activity_logs falhou:`, error.message)
}

async function execute(
  p: FunnelTurnParams,
  config: FunnelConfig,
  state: FunnelState,
  actions: FunnelAction[],
  memoria?: Memoria | null
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
      await notifyTeam(p, config, state, action.reason, memoria)
      await p.deps.log('funnel_handoff', { reason: action.reason, data: state.data })
      p.deps.distribute().catch((e) => console.error(`[Funnel:${p.companyId}] distribuição pós-handoff falhou:`, e?.message))
    } else if (action.type === 'notify') {
      await notifyTeam(p, config, state, action.reason, memoria)
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

  // Áudio que não pôde ser transcrito, no meio da qualificação: avisa em vez de repetir a pergunta.
  const avisoAudio = await unreadableAudioReply(p)
  if (avisoAudio !== null) {
    if (avisoAudio) await p.deps.send([avisoAudio])
    await p.deps.log('funnel_audio_ilegivel', { respondeu: !!avisoAudio }).catch(() => {})
    return { handled: true }
  }

  let config: FunnelConfig
  let result: StepResult
  let prevChecklist: Record<string, unknown> | null
  let reading: Reading
  let prevName: string | undefined
  let memoria: Memoria | null = null
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
    // Memória: a conversa INTEIRA (até 120 mensagens, com dias anteriores, áudios transcritos e o que pessoas da
    // equipe perguntaram), e não só as últimas 14 (achado ao vivo 2026-09-21, lead Isaías).
    const { recent, transcript, count } = await loadConversation(p)
    memoria = (prevChecklist?.memoria as Memoria | undefined) ?? null
    // Texto de cada mensagem NOSSA; em áudio/imagem que enviamos vale o que o arquivo diz (transcrição), não o rótulo
    const outboundNewestFirst = recent
      .filter((m) => m.direcao === 'outbound')
      .map((m) => (m.metadados as { transcricao?: string } | null)?.transcricao || m.texto_da_mensagem || '')

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
    // (estágio 'scheduling' NÃO sai mais daqui: o funil segue tratando recusa, preço, objeção, dúvida e
    // pedido de pessoa; só o que for marcar horário é devolvido ao orquestrador mais abaixo)
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
      const boxAnswer = await answerFromKnowledge({ question: result.needBox, search: p.deps.search, openai, onUsage: p.deps.onUsage, log: p.deps.log })
      result = stepFunnel(config, state, reading, { isFirstTurn, leadText: p.leadText, boxAnswer })
    }

    // Pós-roteiro e o lead só falou de agendamento (horário, dados pro convite...): quem responde é o
    // orquestrador, com a ficha. Nada a gravar aqui.
    if (stageAtStart === 'scheduling' && result.actions.length > 0 && result.actions.every((a) => a.type === 'delegate_scheduling')) {
      return { handled: false, leadName: state.data.nome }
    }

    const midia = !!p.hasMedia
    // Lead que conta algo por conta própria (ramo, Instagram, link) é sempre reconhecido, como a mídia.
    const informou = leadVolunteered(config, state, result.state, p.leadText)

    // Modo conversa: o lead saiu do roteiro (contesta, se confunde, pede algo). O SDR responde de verdade, com a
    // conversa inteira, a memória e os fatos da base, sob conferência em código + revisor. Se ele pediu algo que o
    // SDR não pode fazer, ou se algo barrar, a conversa vai pra uma pessoa (nunca sai texto não aprovado).
    let conversou = false
    if (result.actions.some((a) => a.type === 'converse')) {
      const conv = await runConversation({
        config,
        state: result.state,
        memoria,
        transcript,
        leadText: p.leadText,
        recentOutbound: outboundNewestFirst,
        search: p.deps.search,
        openai,
        onUsage: p.deps.onUsage,
      })
      await p.deps.log('funnel_conversa', { aprovada: !!conv.texto, motivo: conv.motivo, pede_pessoa: conv.pedePessoa, resposta: conv.rascunho }).catch(() => {})
      conversou = true
      if (conv.texto && !conv.pedePessoa) {
        result.actions = [{ type: 'send', texts: [conv.texto] }]
      } else {
        result.state.stage = 'handoff'
        result.actions = [
          {
            type: 'handoff',
            reason: conv.pedePessoa ? 'lead_pediu_algo_fora_do_alcance' : `conversa_sem_resposta_segura:${conv.motivo ?? 'sem_versao'}`,
            texts: conv.texto ? [conv.texto, config.handoff.waitMessage] : [config.handoff.waitMessage],
          },
        ]
      }
    }

    // Preço e objeção: o SDR reescreve o texto aprovado com as próprias palavras, olhando a ficha.
    // Se a forma ou o revisor barrarem, sai o texto aprovado, palavra por palavra (nunca mudo).
    const paraHumanizar = result.actions.find((a): a is Extract<FunnelAction, { type: 'send' }> => a.type === 'send' && !!a.humanize)
    if (paraHumanizar?.humanize && config.humanize !== false) {
      const h = await humanizeScript({
        kind: paraHumanizar.humanize.kind,
        script: paraHumanizar.humanize.script,
        leadText: p.leadText,
        transcript,
        ficha: buildFicha(config, result.state, memoria),
        recentOutbound: outboundNewestFirst,
        openai,
        onUsage: p.deps.onUsage,
      })
      await p.deps.log('funnel_humanizado', { tipo: paraHumanizar.humanize.kind, versao: h.versao, aprovada: !!h.texto, motivo: h.motivo }).catch(() => {})
      const idx = paraHumanizar.humanize.index ?? 0
      if (h.texto) {
        paraHumanizar.texts[idx] = h.texto
      } else if (paraHumanizar.humanize.kind === 'reperguntar') {
        // A reformulação foi barrada e o texto aprovado é IGUAL ao que acabamos de mandar: repetir idêntico soa como
        // bot (achado ao vivo 2026-09-21, lead Isaías: a mesma pergunta duas vezes em 68 segundos). Em vez disso,
        // reconhece o que o lead contou (se contou algo) ou fica quieto esperando; a tentativa não é contada.
        const script = paraHumanizar.texts[idx] ?? ''
        if (outboundNewestFirst.slice(0, 3).some((r) => isRepeatOf(script, r))) {
          paraHumanizar.texts.splice(idx, 1)
          const sid = result.state.askedStep
          if (sid && (result.state.asks[sid] ?? 0) > 0) result.state.asks[sid]--
          if (paraHumanizar.texts.length === 0) {
            if (informou || midia) paraHumanizar.texts.push(buildEcho(config, state.data, result.state.data, midia ? (p.mediaKind ?? 'outro') : 'info'))
            else result.actions = result.actions.map((a) => (a === paraHumanizar ? ({ type: 'silence' } as FunnelAction) : a))
          }
          await p.deps.log('funnel_repeticao_evitada', { pergunta: script, virou: paraHumanizar.texts.length ? 'reconhecimento' : 'silencio' }).catch(() => {})
        }
      }
    }

    // Reação humana: quando o lead contou algo além da resposta seca, uma frase curta reconhece isso
    // antes da próxima pergunta. Opcional e à prova de falha: qualquer problema apaga a frase.
    // Mídia (áudio, imagem...) é SEMPRE respondida: se a frase do SDR for barrada, sai a confirmação
    // dos dados guardados. Funil que ignora o que o lead mandou vira bot.
    if (
      !conversou &&
      shouldReact({
        state: result.state,
        reading,
        actions: result.actions,
        isFirstTurn,
        enabled: config.reactions !== false,
        hasMedia: midia,
        volunteered: informou,
      })
    ) {
      const rx = await buildReaction({
        transcript,
        leadText: p.leadText,
        lastQuestion: outboundNewestFirst[0] ?? '',
        recentOutbound: outboundNewestFirst,
        openai,
        onUsage: p.deps.onUsage,
        media: midia,
        info: !midia && informou,
      })
      let texto = rx.texto
      let usouEco = false
      if (!texto && (midia || informou)) {
        texto = buildEcho(config, state.data, result.state.data, midia ? (p.mediaKind ?? 'outro') : 'info')
        usouEco = true
      }
      await p.deps.log('funnel_reaction', { frase: rx.frase, aprovada: !!rx.texto, motivo: rx.motivo, midia, informou, eco: usouEco ? texto : null }).catch(() => {})
      if (texto) {
        const envio = result.actions[0] as Extract<FunnelAction, { type: 'send' }>
        // Na 1a mensagem o reconhecimento entra ENTRE a apresentação e a pergunta.
        const abertura = isFirstTurn && envio.texts.length === 1 ? splitOpening(envio.texts[0]) : null
        envio.texts = abertura?.intro ? [abertura.intro, texto, abertura.question] : [texto, ...envio.texts]
        if (!midia) result.state.reactionTurn = result.state.turns
      }
    }

    const extra: Record<string, unknown> = {}
    if (result.actions.some((a) => a.type === 'mark_refused')) extra.lead_recusou = true
    if (result.state.stage === 'scheduling') {
      extra.estagio_atual =
        'qualificacao_completa: todos os passos do roteiro foram respondidos. A mensagem explicando a conversa de diagnóstico com o especialista JÁ foi enviada ao lead: NÃO explique o diagnóstico de novo e não use "gratuito". Ofereça direto os horários livres (Consultar_gcal), sem perguntar se pode. Atendimento e reunião só em horário comercial: nunca prometa nem ofereça fora dele.'
    }
    extra.ficha_funil = buildFicha(config, result.state, memoria)
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
    ...(reading.descartados?.length ? { descartados_sem_prova: reading.descartados } : {}),
    stage: result.state.stage,
    acoes: result.actions.map((a) => a.type),
  })

  if (result.actions.some((a) => a.type === 'delegate_scheduling')) {
    // Qualificação completa: antes de o agendamento (motor antigo) pedir dados, uma mensagem fixa
    // explica o que vai acontecer. Só sai uma vez, na virada (depois disso o estágio já é 'scheduling').
    if (stageAtStart !== 'scheduling' && config.closingMessage?.trim()) {
      const nome = result.state.data.nome
      const text = nome ? config.closingMessage.replace(/\{nome\}/g, nome) : config.closingMessage.replace(/\{nome\},?\s*/g, '')
      await p.deps.send([text])
    }
    await syncLeadCrm(p, config, stageAtStart, result.state, result.actions)
    return { handled: false, leadName: result.state.data.nome }
  }

  await execute(p, config, result.state, result.actions, memoria)
  await syncLeadCrm(p, config, stageAtStart, result.state, result.actions)
  // Depois de responder: atualiza a memória da conversa inteira (o lead já foi atendido, não atrasa a resposta)
  await updateMemory(p, config, result.state)
  return { handled: true }
}

/** Conversa inteira do banco (mais recentes primeiro em `recent`; `transcript` em ordem cronológica). */
async function loadConversation(p: FunnelTurnParams) {
  const { data: rows, count } = await p.deps.supabase
    .from('mensagens_do_whatsapp')
    .select('id, texto_da_mensagem, direcao, sender_type, tipo_de_mensagem, url_da_midia, metadados, carimbo_de_data_e_hora', { count: 'exact' })
    .eq('id_da_conversacao', p.conversationId)
    .order('carimbo_de_data_e_hora', { ascending: false })
    .limit(TRANSCRIPT_MAX_MESSAGES)
  // O que a empresa mandou em áudio/imagem (follow-up, fluxos, pessoas) é entendido pelo ARQUIVO enviado, não por
  // texto guardado à parte (achado ao vivo 2026-09-21, lead Isaías: o histórico tinha um texto que o áudio não dizia).
  await enrichOutboundMedia((rows ?? []) as (MediaRow & { id: number | string })[], p.deps.openai, p.deps.supabase)
  const recent = (rows ?? []).filter((m) => (m.texto_da_mensagem ?? '').trim())
  const transcript = formatTranscript([...recent].reverse() as ConvRow[])
  return { recent, transcript, count }
}

/**
 * Memória da conversa: resumo factual + perguntas do lead sem resposta, feitos da conversa inteira e conferidos
 * (forma em código + revisor sim/não). Se barrar, a memória anterior continua. Nunca derruba o atendimento.
 */
async function updateMemory(p: FunnelTurnParams, config: FunnelConfig, state: FunnelState): Promise<void> {
  try {
    const { supabase, openai, onUsage } = p.deps
    const { transcript } = await loadConversation(p)
    if (countMessages(transcript) < MEMORY_MIN_MESSAGES) return

    const out = await buildMemory({ transcript, openai, onUsage })
    await p.deps.log('funnel_memoria', { aprovada: !!out.memoria, motivo: out.motivo, resumo: out.memoria?.resumo ?? out.rascunho, pendencias: out.memoria?.pendencias ?? [] }).catch(() => {})
    if (!out.memoria) return

    const { data: conv } = await supabase.from('conversas_do_whatsapp').select('checklist_atendimento').eq('id', p.conversationId).single()
    const checklist = { ...((conv?.checklist_atendimento as Record<string, unknown> | null) ?? {}), memoria: out.memoria }
    await supabase.from('conversas_do_whatsapp').update({ checklist_atendimento: checklist }).eq('id', p.conversationId)

    // O resumo que a equipe lê no CRM: a narrativa da conversa inteira, com os dados coletados logo abaixo
    const dados = buildResumo(config, state)
    const resumo = dados ? `${out.memoria.resumo}\n\nDados coletados:\n${dados}` : out.memoria.resumo
    await supabase.from('leads').update({ resumo_ia: resumo, updated_at: new Date().toISOString() }).eq('id', p.leadId)
  } catch (err: any) {
    console.error(`[Funnel:${p.companyId}] memória da conversa falhou (atendimento segue):`, err?.message)
  }
}

/** null = não é o caso (segue o fluxo normal); string = texto a enviar ('' = ficar em silêncio). */
async function unreadableAudioReply(p: FunnelTurnParams): Promise<string | null> {
  if (!isUnreadableAudio(p.leadText)) return null
  try {
    const { data: cfgRow } = await p.deps.supabase.from('sdr_funnel_configs').select('enabled, config').eq('company_id', p.companyId).maybeSingle()
    if (!cfgRow?.enabled) return null
    const { data: conv } = await p.deps.supabase.from('conversas_do_whatsapp').select('funnel_state').eq('id', p.conversationId).single()
    const st = loadState(conv?.funnel_state)
    if (!st || st.stage !== 'qualifying') return null // só no meio da qualificação
    const cfg = cfgRow.config as Partial<FunnelConfig>
    return typeof cfg.audioFailReply === 'string' ? cfg.audioFailReply : DEFAULT_AUDIO_FAIL_REPLY
  } catch {
    return null
  }
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
    // Resumo narrativo (memória da conversa) já gravado: quem atualiza é o updateMemory, pra a lista de dados não apagar a narrativa
    const temNarrativa = (lead.resumo_ia ?? '').includes('Dados coletados:')
    if (resumo && !temNarrativa && resumo !== lead.resumo_ia) upd.resumo_ia = resumo

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
