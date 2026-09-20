/**
 * Funil do SDR em código (v2). O CÓDIGO é dono do fluxo, do estado e dos
 * portões (quando perguntar, o que perguntar, quando agendar, quando passar
 * pra um humano) e manda os textos aprovados do cliente palavra por palavra.
 * A IA só LÊ a mensagem do lead (classifica e extrai dados em JSON validado) e,
 * pra pergunta fora do roteiro, responde a partir da base aprovada numa caixa
 * controlada (box.ts). Nada aqui depende de o modelo obedecer prompt.
 *
 * A configuração é por empresa (tabela sdr_funnel_configs), então o mesmo motor
 * atende qualquer cliente novo do Zaapply : muda o dado, não o código.
 */

export type FieldType = 'text' | 'yesno' | 'link_or_media'

export interface FunnelField {
  key: string
  /** Como o campo aparece numa frase ("o nome da empresa", "o ramo"). */
  label: string
  /** Instrução pro leitor : o que extrair e quando deixar vazio. */
  description: string
  type: FieldType
  /** default true */
  required?: boolean
  /**
   * Só aceita o valor quando ESTE passo foi o último perguntado. Evita extrair
   * o nome do contato do WhatsApp, ou tratar "eu decido tudo" solto no começo
   * como a confirmação do decisor (que precisa ser a última pergunta, sozinha).
   */
  mustAskDirectly?: boolean
  /** 'name' : capitaliza cada palavra ("carlos silva" -> "Carlos Silva"). */
  transform?: 'name'
}

export interface FunnelStep {
  id: string
  /** Texto aprovado, palavra por palavra. Aceita {nome}. */
  question: string
  fields: FunnelField[]
  /** Como perguntar de novo quando a resposta não veio/não ficou clara (default : question). */
  clarify?: string
  /** Quando só parte dos campos veio. Aceita {faltando} ("o ramo e a cidade"). */
  partialQuestion?: string
  /** Pergunta extra, uma vez só, quando uma resposta pede complemento (ex: tem perfil -> pedir o link). */
  followUp?: {
    whenField: string
    equals: string
    missingField: string
    question: string
    maxAsks: number
  }
  /** Vezes que pode perguntar antes de desistir do passo (default 3). */
  maxAsks?: number
  /** Se passar do limite: true = segue sem essa resposta; false/omitido = passa pro humano. */
  skippable?: boolean
}

export interface FunnelObjection {
  /** Só o texto que o leitor vê pra reconhecer esse tipo de fala. */
  triggers: string
  /** 'objecao' conta pro limite de insistência; 'faq' é dúvida comum com resposta fixa. */
  kind: 'objecao' | 'faq'
  /** Variantes aprovadas, na ordem em que são usadas (uma por vez, sem repetir). */
  scripts: string[]
}

export interface FunnelConfig {
  version: 1
  steps: FunnelStep[]
  /** Respostas fixas de preço, na ordem (a 1a vez usa a 1a, etc). */
  priceScripts: string[]
  /** Quando o lead insiste no preço de novo : texto + passa pro humano. */
  priceInsistHandoff: string
  /** Quantas perguntas de preço até passar pro humano (default 2). */
  priceHandoffAt?: number
  objections: Record<string, FunnelObjection>
  /** Turnos de objeção 'objecao' tolerados antes de encerrar com elegância. */
  maxObjections: number
  refusalReply: string
  farewellReply: string
  callOffer?: string
  callConfirm?: string
  /**
   * Lead avisa que está ocupado e responde depois : resposta curta, sem pergunta.
   * Ausente = usa o texto padrão do runner; string vazia = fica em silêncio.
   */
  deferReply?: string
  /**
   * Mensagem fixa enviada UMA vez quando o roteiro termina, antes do agendamento pedir dados:
   * explica o que vai acontecer. Aceita {nome}. Ausente = não envia nada.
   */
  closingMessage?: string
  /** Reação humana curta quando o lead conta algo além da resposta. Ausente = ligada; false = desligada. */
  reactions?: boolean
  /** Quando a pergunta fora do roteiro não tem resposta na base. */
  unknownAnswer: string
  handoff: {
    /** O que o lead recebe quando a conversa passa pro humano. */
    waitMessage: string
  }
}

export interface FunnelState {
  v: 1
  stage: 'qualifying' | 'scheduling' | 'handoff' | 'refused'
  data: Record<string, string>
  asks: Record<string, number>
  followUpAsks: Record<string, number>
  skipped: Record<string, boolean>
  askedStep: string | null
  objections: Record<string, number>
  objectionTurns: number
  priceAsked: number
  offScriptFails: number
  readerFailures: number
  botCount: number
  callOffered: boolean
  farewellSent: boolean
  /** Já respondemos o "estou ocupado" e o lead ainda não voltou : não responder de novo. */
  deferSent: boolean
  /** Já esperamos um "ok" sem conteúdo: se o próximo também não responder, aí sim pergunta de novo. */
  okWaited?: boolean
  /** Turno (state.turns) da última reação humana enviada, pro intervalo entre reações. */
  reactionTurn?: number
  turns: number
}

export type Categoria =
  | 'resposta_passo'
  | 'preco'
  | 'objecao'
  | 'pergunta_fora'
  | 'bot_automatico'
  | 'recusa'
  | 'pede_humano'
  | 'pede_ligacao'
  | 'aceita_ligacao'
  | 'despedida'
  | 'ok'
  | 'adiar'
  | 'agendar'
  | 'outro'

export const CATEGORIAS: readonly Categoria[] = [
  'ok',
  'adiar',
  'resposta_passo',
  'preco',
  'objecao',
  'pergunta_fora',
  'bot_automatico',
  'recusa',
  'pede_humano',
  'pede_ligacao',
  'aceita_ligacao',
  'despedida',
  'agendar',
  'outro',
]

/** O que a IA leitora devolve (já validado, ver reader.ts). */
export interface Reading {
  categoria: Categoria
  objecaoTipo: string | null
  dados: Record<string, string>
  confianca: number
  /** O lead disse algo além da resposta seca (dificuldade, história, desabafo): candidato a uma reação humana. */
  comentario?: boolean
  /** true quando o leitor falhou e isto é o valor neutro de fallback. */
  falhou?: boolean
}

export type FunnelAction =
  | { type: 'send'; texts: string[] }
  | { type: 'handoff'; reason: string; texts: string[] }
  | { type: 'notify'; reason: string }
  | { type: 'silence' }
  | { type: 'mark_refused' }
  /** Qualificação completa : quem conduz o agendamento é o orquestrador atual. */
  | { type: 'delegate_scheduling' }

export interface StepInput {
  /** Nenhuma mensagem nossa foi enviada ainda nesta conversa. */
  isFirstTurn: boolean
  /** Texto do lead neste turno (vira a pergunta enviada à caixa controlada). */
  leadText: string
  /** Resposta da caixa controlada (string = ok, null = sem base, undefined = ainda não consultada). */
  boxAnswer?: string | null
}

export interface StepResult {
  state: FunnelState
  actions: FunnelAction[]
  /** Se definido, o runner precisa consultar a caixa com esta pergunta e chamar stepFunnel de novo. */
  needBox?: string
}

export function initialState(): FunnelState {
  return {
    v: 1,
    stage: 'qualifying',
    data: {},
    asks: {},
    followUpAsks: {},
    skipped: {},
    askedStep: null,
    objections: {},
    objectionTurns: 0,
    priceAsked: 0,
    offScriptFails: 0,
    readerFailures: 0,
    botCount: 0,
    callOffered: false,
    farewellSent: false,
    deferSent: false,
    turns: 0,
  }
}
