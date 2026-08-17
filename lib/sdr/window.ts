/**
 * Modelo de janela de mensagem do WhatsApp, em dois eixos independentes:
 *
 *  - Eixo A (serviço, 24h): reseta a cada mensagem que o lead manda.
 *    Controla SE dá pra mandar mensagem livre agora (fora dela, só template).
 *  - Eixo B (CTWA, 72h): só existe pra conversa vinda de anúncio Click-to-
 *    WhatsApp da Meta. Começa a contar da PRIMEIRA resposta do negócio
 *    (não da mensagem do lead), não reseta. Controla se a mensagem é
 *    grátis ou cobrada (a partir de 1º/out/2026, fora das 72h vira cobrado).
 *
 * Puro, sem I/O : importável tanto no client (badges) quanto no server
 * (checagem antes de enviar). Nenhuma chamada a banco ou API aqui.
 */

const SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000
const CTWA_WINDOW_MS = 72 * 60 * 60 * 1000

// A partir desta data, mensagem de serviço fora da janela CTWA passa a
// ser cobrada pela Meta (hoje ainda é grátis dentro das 24h de serviço).
export const CHARGING_CUTOVER = new Date('2026-10-01T00:00:00Z')

export interface WindowInput {
  ultimaMensagemInboundAt: string | null
  ctwaClid: string | null
  ctwaFirstReplyAt: string | null
  now?: Date
}

export interface WindowState {
  serviceWindow: { open: boolean; msLeft: number }
  // null = essa conversa nunca teve ctwa_clid, o eixo CTWA não se aplica
  ctwaWindow: { active: boolean; awaitingFirstReply: boolean; msLeft: number } | null
  billing: 'free_ctwa' | 'free_24h' | 'charged_24h' | 'blocked'
}

export function computeWindowState(input: WindowInput): WindowState {
  const now = input.now ?? new Date()

  const lastInbound = input.ultimaMensagemInboundAt ? new Date(input.ultimaMensagemInboundAt) : null
  const serviceMsLeft = lastInbound ? lastInbound.getTime() + SERVICE_WINDOW_MS - now.getTime() : -1
  const serviceWindow = { open: serviceMsLeft > 0, msLeft: Math.max(serviceMsLeft, 0) }

  let ctwaWindow: WindowState['ctwaWindow'] = null
  if (input.ctwaClid) {
    if (!input.ctwaFirstReplyAt) {
      ctwaWindow = { active: false, awaitingFirstReply: true, msLeft: 0 }
    } else {
      const firstReply = new Date(input.ctwaFirstReplyAt)
      const ctwaMsLeft = firstReply.getTime() + CTWA_WINDOW_MS - now.getTime()
      ctwaWindow = { active: ctwaMsLeft > 0, awaitingFirstReply: false, msLeft: Math.max(ctwaMsLeft, 0) }
    }
  }

  let billing: WindowState['billing']
  if (ctwaWindow?.active) {
    billing = 'free_ctwa'
  } else if (serviceWindow.open) {
    billing = now.getTime() >= CHARGING_CUTOVER.getTime() ? 'charged_24h' : 'free_24h'
  } else {
    billing = 'blocked'
  }

  return { serviceWindow, ctwaWindow, billing }
}

export function canSendFreeform(state: WindowState): boolean {
  return state.serviceWindow.open
}

function fmtDuration(ms: number): string {
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  if (h > 24) return `${Math.floor(h / 24)}d ${h % 24}h`
  if (h > 0) return `${h}h`
  return `${m}min`
}

/** Texto pronto pra badge/UI, refletindo os dois eixos separados. */
export function formatWindowBadge(state: WindowState): string {
  if (!state.serviceWindow.open) return '24h: Fora da janela — só template'

  const serviceText = `24h: ${fmtDuration(state.serviceWindow.msLeft)} restantes`

  if (state.ctwaWindow?.active) {
    return `${serviceText} · Grátis (CTWA 72h: ${fmtDuration(state.ctwaWindow.msLeft)} restantes)`
  }
  if (state.ctwaWindow?.awaitingFirstReply) {
    return `${serviceText} · CTWA aguardando primeira resposta`
  }
  if (state.billing === 'charged_24h') {
    return `${serviceText} · Cobrado (sem CTWA ativo)`
  }
  return `${serviceText} · Grátis`
}
