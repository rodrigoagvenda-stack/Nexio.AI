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
  HumanizeHint,
  Reading,
  StepInput,
  StepResult,
} from './types'

const MIN_CONFIDENCE = 0.5
const DEFAULT_MAX_ASKS = 3
const MAX_OFF_SCRIPT_FAILS = 2
const MAX_READER_FAILURES = 3
/** Na 3a vez que o lead pergunta "o que é isso" a conversa passa pra uma pessoa em vez de repetir a explicação. */
const MAX_CONTEXT_ASKS = 3
/** Categorias que o funil continua tratando depois do fim do roteiro (o resto vai pro agendamento). */
const POS_ROTEIRO = new Set<string>([
  'recusa', 'preco', 'objecao', 'pergunta_fora', 'pede_humano', 'pede_ligacao', 'aceita_ligacao', 'bot_automatico', 'adiar', 'despedida',
])
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

function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/** O lead está corrigindo ou se apresentando de forma explícita ("meu nome é X", "na verdade é Y"). */
const CORRECTION_RE = /\b(na verdade|corrigindo|correcao|errei|escrevi errado|o certo e|o correto e|quis dizer|meu nome e|me chamo|pode me chamar de)\b/

/**
 * "Oi Bruno" / "Bom dia, Bruno" é o lead falando COM a gente (Bruno é da equipe), não o nome dele.
 * Achado ao vivo 2026-09-21 (lead Elizeu): o CRM ficou com o nome do Bruno. Só barra o padrão de
 * vocativo; quem responde "Bruno" à pergunta de nome (ou diz "meu nome é Bruno") continua valendo.
 */
function isVocativeOfAgent(config: FunnelConfig, value: string, leadText: string): boolean {
  const agents = (config.agentNames ?? []).map(norm).filter(Boolean)
  if (agents.length === 0) return false
  const first = norm(value).split(' ')[0]
  if (!agents.includes(first)) return false
  const t = norm(leadText).trim()
  if (CORRECTION_RE.test(t)) return false
  const a = first.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const greeting = '(?:oi|ola|opa|eai|e ai|fala|salve|hey|bom dia|boa tarde|boa noite)'
  return new RegExp(`^(?:${greeting}[,!.\\s]+)+(?:sr\\.?\\s+|sra\\.?\\s+)?${a}\\b|^${a}\\s*[,!]`).test(t)
}

function mergeData(config: FunnelConfig, state: FunnelState, reading: Reading, leadText: string): void {
  if (reading.falhou || reading.confianca < MIN_CONFIDENCE) return
  const idx = fieldIndex(config)
  const correcting = CORRECTION_RE.test(norm(leadText))
  for (const [key, raw] of Object.entries(reading.dados)) {
    const hit = idx.get(key)
    if (!hit) continue
    const askedNow = state.askedStep === hit.step.id
    // O nome só é aceito logo depois de perguntado, ou quando a própria pessoa se apresenta/corrige.
    if (hit.field.mustAskDirectly && !askedNow && !(correcting && hit.field.transform === 'name')) continue
    const value = normalizeValue(hit.field, raw)
    if (value === null) continue
    if (hit.field.transform === 'name' && isVocativeOfAgent(config, value, leadText)) continue
    // Não sobrescreve resposta antiga, salvo se este passo acabou de ser perguntado ou se o lead
    // corrigiu por escrito (texto vale mais que o que foi captado de áudio).
    if (state.data[key] && !askedNow && !correcting) continue
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
      // Qualquer dado do passo já preenchido conta (inclusive os opcionais, ex: só o nome da empresa).
      return { kind: 'main', step, missing, someAnswered: step.fields.some((f) => !!state.data[f.key]) }
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
      // Já no pós-roteiro: só responde (não há próxima pergunta nem nova entrega pro agendamento).
      if (state.stage === 'scheduling') {
        return prefix.length > 0 ? { state, actions: [{ type: 'send', texts: prefix }] } : { state, actions: [{ type: 'delegate_scheduling' }] }
      }
      state.stage = 'scheduling'
      state.askedStep = null
      return { state, actions: [{ type: 'delegate_scheduling' }] }
    }

    let text: string
    let reask = false
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
      // Achado ao vivo 2026-09-20 (lead Francisco): se o lead já respondeu ALGUMA coisa do passo
      // (mesmo só o nome da empresa), pergunta só o que falta em vez de repetir a pergunta inteira.
      if (asks === 0) text = step.question
      else if (pending.someAnswered && step.partialQuestion) {
        text = step.partialQuestion.replace('{faltando}', joinLabels(pending.missing.map((f) => f.label)))
      } else text = step.clarify ?? step.question
      state.asks[step.id] = asks + 1
      state.askedStep = step.id
      reask = asks > 0
    }

    const finalText = fillName(text, state)
    const send: Extract<FunnelAction, { type: 'send' }> = { type: 'send', texts: [...prefix, finalText] }
    // Perguntar de novo a mesma coisa com as mesmas palavras soa como bot: o SDR reformula (revisado;
    // se barrar, sai a pergunta aprovada). Só quando a pergunta vai sozinha na mensagem.
    if (reask && prefix.length === 0) send.humanize = { kind: 'reperguntar', script: finalText }
    return { state, actions: [send] }
  }
}

/** Marca o texto de script da mensagem como reescrevível pelo SDR (o runner decide, com revisão). */
function marcarHumanizar(res: StepResult, kind: HumanizeHint['kind'], script: string): StepResult {
  const envio = res.actions.find((a) => a.type === 'send') as Extract<FunnelAction, { type: 'send' }> | undefined
  // Lista com uma linha por item (ex.: os planos) sai palavra por palavra: reescrever vira parágrafo confuso.
  if (script.split('\n').length >= 3) return res
  if (envio && envio.texts[0] === script) envio.humanize = { kind, script }
  return res
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
  // Depois do roteiro o funil continua vivo pro que NÃO é marcar horário (recusa, preço, objeção, dúvida,
  // pedido de pessoa, despedida...). Achado ao vivo 2026-09-20 (lead Marcelo): tudo isso caía no SDR antigo
  // sem as proteções, e foi onde o atendimento quebrou. Só o ato de agendar fica com o orquestrador.
  if (state.stage === 'scheduling') {
    const c0 = reading.falhou ? 'outro' : reading.categoria
    const c = reading.confianca >= MIN_CONFIDENCE ? c0 : 'outro'
    if (!POS_ROTEIRO.has(c)) return { state, actions: [{ type: 'delegate_scheduling' }] }
  }

  mergeData(config, state, reading, input.leadText)
  applyImplications(config, state)

  let cat = reading.falhou ? 'outro' : reading.categoria
  if (reading.confianca < MIN_CONFIDENCE && cat !== 'resposta_passo' && cat !== 'outro') cat = 'outro'
  // Primeira mensagem : é abertura (muitas vêm de anúncio com texto pronto, que pode até citar valor).
  if (
    input.isFirstTurn &&
    (cat === 'preco' || cat === 'objecao' || cat === 'pergunta_fora' || cat === 'agendar' || cat === 'adiar' || cat === 'duvida_contexto')
  ) {
    cat = 'outro'
  }
  // O lead voltou a falar de outra coisa : o próximo "estou ocupado" merece resposta de novo.
  if (cat !== 'adiar') state.deferSent = false
  // "Ok" sem conteúdo: primeira vez só espera (o lead pode estar dizendo "vou mandar"); repetir a
  // pergunta na hora soa como bot (achado ao vivo 2026-09-20, lead Erasmo). Se o próximo também
  // não responder nada, aí a pergunta volta.
  if (cat === 'ok') {
    if (state.stage === 'qualifying' && !state.okWaited && !input.isFirstTurn) {
      state.okWaited = true
      return silence(state)
    }
    cat = 'outro'
  } else {
    state.okWaited = false
  }

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
      // Política: responde de verdade e nunca repete a mesma frase vaga. Roteiro já terminado: a 1a resposta
      // fecha chamando pro horário; nas demais usa a sequência normal de textos.
      const usaPosRoteiro = state.stage === 'scheduling' && state.priceAsked === 1 && !!config.pricePosRoteiro
      const script = usaPosRoteiro ? config.pricePosRoteiro! : config.priceScripts[(state.priceAsked - 1) % config.priceScripts.length]
      const res = hasQuestion(script) ? sendOnly(state, [script]) : askNext(config, state, [script])
      return marcarHumanizar(res, 'preco', script)
    }

    case 'despedida': {
      // Depois do roteiro: agradece uma vez e fica quieto (achado ao vivo: despedida duplicada, lead André).
      if (state.stage === 'scheduling') {
        if (state.farewellSent) return silence(state)
        state.farewellSent = true
        return { state, actions: [{ type: 'send', texts: [config.farewellReply] }] }
      }
      break // durante a qualificação "obrigado" é resposta comum
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
        const res = hasQuestion(script) ? sendOnly(state, [script]) : askNext(config, state, [script])
        // Só objeção de verdade é reescrita pelo SDR; dúvida comum (dados da empresa, CNPJ) sai palavra por palavra.
        return obj.kind === 'objecao' ? marcarHumanizar(res, 'objecao', script) : res
      }
      if (obj.kind === 'objecao') return handoff(state, config, `objecao_esgotada:${key}`)
      // faq já respondida uma vez e o lead voltou a perguntar : cai na caixa controlada
      return foraDoRoteiro(config, state, input)
    }

    case 'pergunta_fora':
      return foraDoRoteiro(config, state, input)

    case 'duvida_contexto': {
      // Lead não entendeu do que se trata ("o que seria?", "quem é?"): responde ISSO primeiro e só depois
      // segue o funil. Achado ao vivo 2026-09-21 (lead Bafão): perguntou "o que seria?" e recebeu "Qual o
      // seu nome?" de novo, como se não tivesse dito nada.
      state.contextAsked = (state.contextAsked ?? 0) + 1
      if (state.contextAsked >= MAX_CONTEXT_ASKS) return handoff(state, config, 'lead_nao_entende')
      const script = config.aboutReply
      if (!script) return foraDoRoteiro(config, state, input)
      const res = hasQuestion(script) ? sendOnly(state, [script]) : askNext(config, state, [script])
      return marcarHumanizar(res, 'contexto', script)
    }

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
