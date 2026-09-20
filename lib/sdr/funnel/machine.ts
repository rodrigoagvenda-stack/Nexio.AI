/**
 * Máquina de estados do funil : função PURA (sem banco, sem rede, sem IA).
 * Recebe o estado guardado, a leitura da mensagem (JSON já validado) e devolve
 * o novo estado + as ações a executar. Toda decisão do fluxo vive aqui, então
 * dá pra testar com conversas roteirizadas (scripts/test-funnel-machine.ts) e
 * o resultado é o mesmo toda vez : nada de "o modelo às vezes esquece".
 */
import type {
  FunnelAction,
  FunnelConfig,
  FunnelField,
  FunnelState,
  FunnelStep,
  Reading,
  StepInput,
  StepResult,
} from './types'

const MIN_CONFIDENCE = 0.5
const DEFAULT_MAX_ASKS = 3
const MAX_OFF_SCRIPT_FAILS = 2
const MAX_READER_FAILURES = 3
const DEFAULT_DEFER_REPLY = 'Sem problema, responde com calma. Quando puder, me chama aqui.'

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}

/** Qualquer "?" no texto : se o texto fixo já pergunta algo, não emendamos a pergunta do funil (uma pergunta por vez). */
function hasQuestion(text: string): boolean {
  return text.includes('?')
}

// ─── Dados ──────────────────────────────────────────────────────────────

function fieldIndex(config: FunnelConfig): Map<string, { field: FunnelField; step: FunnelStep }> {
  const idx = new Map<string, { field: FunnelField; step: FunnelStep }>()
  for (const step of config.steps) for (const field of step.fields) idx.set(field.key, { field, step })
  return idx
}

function titleCase(s: string): string {
  return s
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(' ')
}

function normalizeValue(field: FunnelField, raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const v = raw.trim().replace(/\s+/g, ' ')
  if (!v) return null
  if (field.type === 'yesno') {
    const low = v.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    if (/^(sim|s|yes|true|tem|possui|possuo|tenho)\b/.test(low)) return 'sim'
    if (/^nao\s+sei\b/.test(low)) return null
    if (/^(nao|n|no|false|nenhum|nunca)\b/.test(low)) return 'nao'
    return null
  }
  const limited = v.slice(0, field.type === 'link_or_media' ? 300 : 200)
  return field.transform === 'name' ? titleCase(limited) : limited
}

function mergeData(config: FunnelConfig, state: FunnelState, reading: Reading): void {
  if (reading.falhou || reading.confianca < MIN_CONFIDENCE) return
  const idx = fieldIndex(config)
  for (const [key, raw] of Object.entries(reading.dados)) {
    const hit = idx.get(key)
    if (!hit) continue
    const askedNow = state.askedStep === hit.step.id
    if (hit.field.mustAskDirectly && !askedNow) continue
    const value = normalizeValue(hit.field, raw)
    if (value === null) continue
    // Não sobrescreve resposta antiga, salvo se este passo acabou de ser perguntado (correção).
    if (state.data[key] && !askedNow) continue
    state.data[key] = value
  }
}

/**
 * Mandar o link/print pedido JÁ responde a pergunta "você tem?". Derivado da própria
 * pergunta extra do passo (followUp : "se tem, peça o link"): se o dado do link está
 * preenchido e o sim/não ainda não, o sim/não é o valor do gatilho. Achado ao vivo
 * 2026-09-20 (lead Isaías): mandou o link do perfil e o funil perguntou de novo
 * "você tem o perfil?", porque o leitor guardou só o link.
 */
function applyImplications(config: FunnelConfig, state: FunnelState): void {
  for (const step of config.steps) {
    const fu = step.followUp
    if (fu && state.data[fu.missingField] && !state.data[fu.whenField]) {
      state.data[fu.whenField] = fu.equals
    }
  }
}

// ─── Próximo passo ──────────────────────────────────────────────────────

type Pending =
  | { kind: 'main'; step: FunnelStep; missing: FunnelField[]; someAnswered: boolean }
  | { kind: 'followup'; step: FunnelStep }

function nextPending(config: FunnelConfig, state: FunnelState): Pending | null {
  for (const step of config.steps) {
    if (state.skipped[step.id]) continue
    const required = step.fields.filter((f) => f.required !== false)
    const missing = required.filter((f) => !state.data[f.key])
    if (missing.length > 0) {
      return { kind: 'main', step, missing, someAnswered: missing.length < required.length }
    }
    const fu = step.followUp
    if (
      fu &&
      state.data[fu.whenField] === fu.equals &&
      !state.data[fu.missingField] &&
      (state.followUpAsks[step.id] ?? 0) < fu.maxAsks
    ) {
      return { kind: 'followup', step }
    }
  }
  return null
}

function joinLabels(labels: string[]): string {
  if (labels.length <= 1) return labels[0] ?? ''
  return `${labels.slice(0, -1).join(', ')} e ${labels[labels.length - 1]}`
}

function fillName(text: string, state: FunnelState): string {
  const nome = state.data.nome
  if (nome) return text.replace(/\{nome\}/g, nome)
  return text.replace(/\{nome\},?\s*/g, '').replace(/^\s*[a-zà-ú]/, (c) => c.toUpperCase())
}

function handoff(state: FunnelState, config: FunnelConfig, reason: string, text?: string): StepResult {
  state.stage = 'handoff'
  return { state, actions: [{ type: 'handoff', reason, texts: [text ?? config.handoff.waitMessage] }] }
}

function silence(state: FunnelState): StepResult {
  return { state, actions: [{ type: 'silence' }] }
}

/** Pergunta o próximo passo pendente (com textos fixos antes, se houver). */
function askNext(config: FunnelConfig, state: FunnelState, prefix: string[]): StepResult {
  for (;;) {
    const pending = nextPending(config, state)
    if (!pending) {
      state.stage = 'scheduling'
      state.askedStep = null
      return { state, actions: [{ type: 'delegate_scheduling' }] }
    }

    let text: string
    if (pending.kind === 'followup') {
      const fu = pending.step.followUp!
      state.followUpAsks[pending.step.id] = (state.followUpAsks[pending.step.id] ?? 0) + 1
      state.askedStep = pending.step.id
      text = fu.question
    } else {
      const { step } = pending
      const asks = state.asks[step.id] ?? 0
      if (asks >= (step.maxAsks ?? DEFAULT_MAX_ASKS)) {
        if (step.skippable) {
          state.skipped[step.id] = true
          continue
        }
        return handoff(state, config, `lead_nao_responde:${step.id}`)
      }
      if (asks === 0) text = step.question
      else if (pending.someAnswered && step.partialQuestion) {
        text = step.partialQuestion.replace('{faltando}', joinLabels(pending.missing.map((f) => f.label)))
      } else text = step.clarify ?? step.question
      state.asks[step.id] = asks + 1
      state.askedStep = step.id
    }

    return { state, actions: [{ type: 'send', texts: [...prefix, fillName(text, state)] }] }
  }
}

/** Envia só o texto fixo (sem emendar pergunta do funil), usado quando o próprio texto já termina em pergunta. */
function sendOnly(state: FunnelState, texts: string[], extra: FunnelAction[] = []): StepResult {
  state.askedStep = null
  return { state, actions: [{ type: 'send', texts }, ...extra] }
}

// ─── Passo do funil ─────────────────────────────────────────────────────

export function stepFunnel(
  config: FunnelConfig,
  prev: FunnelState,
  reading: Reading,
  input: StepInput
): StepResult {
  const state = clone(prev)
  state.turns++

  if (reading.falhou) state.readerFailures++
  else state.readerFailures = 0
  if (state.readerFailures >= MAX_READER_FAILURES && state.stage !== 'handoff') {
    return handoff(state, config, 'leitor_falhou')
  }

  if (state.stage === 'handoff') return silence(state)
  if (state.stage === 'scheduling') return { state, actions: [{ type: 'delegate_scheduling' }] }

  mergeData(config, state, reading)
  applyImplications(config, state)

  let cat = reading.falhou ? 'outro' : reading.categoria
  if (reading.confianca < MIN_CONFIDENCE && cat !== 'resposta_passo' && cat !== 'outro') cat = 'outro'
  // Primeira mensagem : é abertura (muitas vêm de anúncio com texto pronto, que pode até citar valor).
  if (input.isFirstTurn && (cat === 'preco' || cat === 'objecao' || cat === 'pergunta_fora' || cat === 'agendar' || cat === 'adiar')) {
    cat = 'outro'
  }
  // O lead voltou a falar de outra coisa : o próximo "estou ocupado" merece resposta de novo.
  if (cat !== 'adiar') state.deferSent = false

  if (state.stage === 'refused') {
    const reopens =
      cat === 'pergunta_fora' ||
      cat === 'preco' ||
      cat === 'objecao' ||
      cat === 'agendar' ||
      (cat === 'resposta_passo' && Object.keys(reading.dados).length > 0)
    if (!reopens) {
      if (cat === 'despedida' && !state.farewellSent) {
        state.farewellSent = true
        return { state, actions: [{ type: 'send', texts: [config.farewellReply] }] }
      }
      return silence(state)
    }
    state.stage = 'qualifying'
    state.objectionTurns = 0
  }

  switch (cat) {
    case 'adiar': {
      // Lead pediu espaço ("tenho um curso agora, respondo depois"): respeita. Uma frase curta
      // sem pergunta, uma vez só, e NÃO repete a pergunta pendente nem avança o funil.
      // askedStep continua o mesmo : a resposta dele, quando vier, ainda vale pro passo pendente.
      if (state.deferSent) return silence(state)
      state.deferSent = true
      const reply = config.deferReply ?? DEFAULT_DEFER_REPLY
      return reply ? { state, actions: [{ type: 'send', texts: [reply] }] } : silence(state)
    }

    case 'bot_automatico':
      state.botCount++
      return silence(state)

    case 'recusa':
      state.stage = 'refused'
      return { state, actions: [{ type: 'send', texts: [config.refusalReply] }, { type: 'mark_refused' }] }

    case 'pede_humano':
      return handoff(state, config, 'lead_pediu_humano')

    case 'pede_ligacao':
    case 'aceita_ligacao': {
      if (cat === 'pede_ligacao' && config.callOffer && !state.callOffered) {
        state.callOffered = true
        return sendOnly(state, [config.callOffer])
      }
      if (!config.callConfirm) return handoff(state, config, 'lead_pediu_ligacao')
      if (cat === 'aceita_ligacao' && !state.callOffered) break // ninguém ofereceu : trata como resposta comum
      state.callOffered = false
      const next = askNext(config, state, [config.callConfirm])
      next.actions.unshift({ type: 'notify', reason: 'lead_quer_ligacao' })
      return next
    }

    case 'preco': {
      state.priceAsked++
      if (state.priceAsked >= (config.priceHandoffAt ?? 2) || config.priceScripts.length === 0) {
        return handoff(state, config, 'preco_insistente', config.priceInsistHandoff)
      }
      const script = config.priceScripts[(state.priceAsked - 1) % config.priceScripts.length]
      return hasQuestion(script) ? sendOnly(state, [script]) : askNext(config, state, [script])
    }

    case 'objecao': {
      const key = reading.objecaoTipo
      const obj = key ? config.objections[key] : undefined
      if (!key || !obj) break // tipo desconhecido : trata como resposta comum
      if (obj.kind === 'objecao') {
        state.objectionTurns++
        if (state.objectionTurns > config.maxObjections) {
          state.stage = 'refused'
          return { state, actions: [{ type: 'send', texts: [config.refusalReply] }, { type: 'mark_refused' }] }
        }
      }
      const used = state.objections[key] ?? 0
      if (used < obj.scripts.length) {
        state.objections[key] = used + 1
        const script = obj.scripts[used]
        return hasQuestion(script) ? sendOnly(state, [script]) : askNext(config, state, [script])
      }
      if (obj.kind === 'objecao') return handoff(state, config, `objecao_esgotada:${key}`)
      // faq já respondida uma vez e o lead voltou a perguntar : cai na caixa controlada
      return foraDoRoteiro(config, state, input)
    }

    case 'pergunta_fora':
      return foraDoRoteiro(config, state, input)

    default:
      break
  }

  // resposta_passo, outro, agendar (portão : antes de agendar, terminar o roteiro), despedida no meio da qualificação
  return askNext(config, state, [])
}

function foraDoRoteiro(config: FunnelConfig, state: FunnelState, input: StepInput): StepResult {
  if (input.boxAnswer === undefined) return { state, actions: [], needBox: input.leadText }
  if (typeof input.boxAnswer === 'string') {
    return hasQuestion(input.boxAnswer) ? sendOnly(state, [input.boxAnswer]) : askNext(config, state, [input.boxAnswer])
  }
  state.offScriptFails++
  if (state.offScriptFails >= MAX_OFF_SCRIPT_FAILS) return handoff(state, config, 'sem_resposta_na_base')
  return askNext(config, state, [config.unknownAnswer])
}
