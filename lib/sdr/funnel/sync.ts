/**
 * Sincroniza o funil com a conversa REAL. Quando uma pessoa assume no meio e faz
 * perguntas do roteiro por conta própria (achado ao vivo 2026-09-20, lead Isaías),
 * o estado guardado fica desatualizado: o funil acha que a última pergunta foi
 * outra e lê o "Sim" do lead contra a pergunta errada. Aqui a pergunta pendente é
 * deduzida do que foi de fato enviado, por quem for.
 */
import { isRepeatOf } from '../output-guard'
import type { FunnelConfig, FunnelState } from './types'

const LOOKBACK = 4 // quantas mensagens enviadas mais recentes olhar

function norm(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Mesma pergunta? Texto curto ("Tem site?") só por igualdade; o resto por similaridade/contenção. */
function sameQuestion(sent: string, expected: string): boolean {
  const a = norm(sent)
  const b = norm(expected)
  if (!a || !b) return false
  if (a === b) return true
  return isRepeatOf(sent, expected)
}

/**
 * Qual passo do roteiro a mensagem enviada mais recente representa (procura nas
 * últimas mensagens, da mais nova pra mais antiga). null = nenhuma é pergunta do roteiro.
 */
export function detectAskedStep(config: FunnelConfig, state: FunnelState, outboundNewestFirst: string[]): string | null {
  const nome = state.data.nome
  for (const text of outboundNewestFirst.slice(0, LOOKBACK)) {
    for (const step of config.steps) {
      const variants = [step.question, step.clarify, step.followUp?.question].filter((v): v is string => !!v)
      for (const v of variants) {
        const filled = nome ? v.replace(/\{nome\}/g, nome) : v.replace(/\{nome\},?\s*/g, '')
        if (sameQuestion(text, filled)) return step.id
      }
    }
  }
  return null
}
