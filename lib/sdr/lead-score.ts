// Peça E do plano "máquina de vendas completa": score determinístico
// 0-100, sem chamada de IA nova, pra ordenar a lista de Atendimento por
// "quem atacar primeiro". Recalculado nos mesmos pontos que já escrevem a
// conversa (lib/sdr/inbound.ts a cada mensagem, e nas trocas de kanban_stage)
// — função pura, sem cron novo.
//
// Deliberadamente NÃO tem componente de "recência" que decai com o tempo:
// um valor gravado só no momento de uma nova mensagem nunca decairia sozinho
// (ficaria congelado até a próxima mensagem chegar, o que é o oposto do que
// "recência" deveria significar). Em vez disso, quem ordena por lead_score
// usa hora_da_ultima_mensagem como critério de desempate — recência sai de
// graça no ORDER BY, sem precisar de cron nem de campo que fica velho.

export type KanbanStage = 'novo' | 'qualificacao' | 'fila' | 'em_atendimento' | 'negociacao' | 'fechado'
export type NivelInteresse = 'Quente 🔥' | 'Morno 🟡' | 'Frio ❄️' | null | undefined

export interface LeadScoreInput {
  /** Contagem de mensagens inbound na conversa inteira (profundidade de troca). */
  mensagensRecebidas: number
  /** Timestamp da última mensagem outbound (nossa) antes desta inbound, se houver. */
  lastOutboundAt: string | null
  /** Timestamp da mensagem inbound que disparou o recálculo. */
  currentInboundAt: string
  kanbanStage: KanbanStage | string | null
  nivelInteresse: NivelInteresse
}

const STAGE_POINTS: Record<string, number> = {
  novo: 0,
  qualificacao: 10,
  fila: 15,
  em_atendimento: 20,
  negociacao: 30,
  fechado: 30,
}

function depthPoints(mensagensRecebidas: number): number {
  return Math.min(Math.max(mensagensRecebidas, 0) * 3, 30)
}

function latencyPoints(lastOutboundAt: string | null, currentInboundAt: string): number {
  if (!lastOutboundAt) return 10 // primeira mensagem da conversa: neutro, sem histórico pra medir
  const ms = new Date(currentInboundAt).getTime() - new Date(lastOutboundAt).getTime()
  if (!Number.isFinite(ms) || ms < 0) return 10
  const minutes = ms / 60_000
  if (minutes <= 1) return 20
  if (minutes <= 5) return 15
  if (minutes <= 30) return 10
  if (minutes <= 120) return 5
  return 0
}

function stagePoints(kanbanStage: string | null): number {
  return STAGE_POINTS[kanbanStage ?? 'novo'] ?? 0
}

function interesseBonus(nivelInteresse: NivelInteresse): number {
  if (nivelInteresse === 'Quente 🔥') return 15
  if (nivelInteresse === 'Morno 🟡') return 7
  return 0
}

export function computeLeadScore(input: LeadScoreInput): number {
  const total =
    depthPoints(input.mensagensRecebidas) +
    latencyPoints(input.lastOutboundAt, input.currentInboundAt) +
    stagePoints(input.kanbanStage) +
    interesseBonus(input.nivelInteresse)
  return Math.max(0, Math.min(100, Math.round(total)))
}
