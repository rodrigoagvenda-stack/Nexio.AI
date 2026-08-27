/**
 * Cliente uazapi : abstrai todas as chamadas HTTP para a API da uazapi.
 * Cada instância recebe sua própria URL base + token (isolamento por empresa).
 */

export interface UazapiConfig {
  instanceUrl: string  // ex: https://nexioai.uazapi.com
  token: string
}

export interface UazapiInstance {
  name: string
  token: string
  status: 'disconnected' | 'connecting' | 'connected'
  qrcode?: string
  pairingCode?: string
  phone?: string
}

export interface UazapiSendTextParams {
  number: string
  text: string
  delay?: number
  readchat?: boolean
  replyid?: string
}

export interface UazapiSendMediaParams {
  number: string
  type: 'image' | 'video' | 'document' | 'audio' | 'ptt' | 'myaudio' | 'ptv' | 'sticker'
  file: string
  text?: string
  docName?: string
  delay?: number
  viewOnce?: boolean
}

export interface UazapiSendMenuParams {
  number: string
  type: 'button' | 'list' | 'poll' | 'carousel'
  text: string
  choices: string[]
  selectableCount?: number
}

export interface UazapiCarouselItem {
  text: string
  image?: string
  buttons?: string[]
}

export interface UazapiSendCarouselParams {
  number: string
  text: string
  carousel: UazapiCarouselItem[]
}

export interface UazapiSendLocationParams {
  number: string
  name: string
  address: string
  latitude: number
  longitude: number
}

export type StepTipoMensagem =
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'ptt'
  | 'document'
  | 'menu'
  | 'carousel'
  | 'location'
  | 'sticker'
  | 'agendamento'
  | 'sentiment'
  | 'goal'
  | 'sub_flow'
  | 'wait_event'
  | 'pos_condicao'
  | 'gerar_cobranca'
  | 'aguardar_pagamento'

export interface ButtonAction {
  status?: string         // mover lead para este status
  schedule_days?: number  // reagendar remarketing em N dias
  stop_sequence?: boolean // desativar a sequência deste lead
}

export interface StepMediaConfig {
  file?: string
  text?: string
  docName?: string
  viewOnce?: boolean
  menuType?: 'button' | 'list' | 'poll'
  choices?: string[]
  selectableCount?: number
  button_actions?: Record<string, ButtonAction>
  carousel?: UazapiCarouselItem[]
  name?: string
  address?: string
  latitude?: number
  longitude?: number
  blocos?: any[] | null
  duracao?: number
  mensagemInicial?: string
  subSequenceId?: string
  event?: string
  pattern?: string
  offset_unit?: 'days' | 'hours' | 'minutes'
}

export interface UazapiWebhookMessage {
  BaseUrl: string
  EventType: string
  instanceName: string
  owner: string
  token: string
  chat: {
    phone: string
    wa_chatid: string
    wa_lastMessageTextVote: string
    wa_lastMessageType: string
    wa_contactName: string
    wa_name: string
    id?: string
    image?: string
    imagePreview?: string
  }
  message: {
    id: string
    messageid: string
    fromMe: boolean
    senderName: string
    text: string
    content?: {
      mimetype?: string
    }
    messageTimestamp: number
    messageType: string
    referral?: {
      sourceUrl?: string
      sourceType?: string
      sourceId?: string   // ad ID
      headline?: string   // título do criativo
      body?: string
      ctwaClid?: string   // click ID para CAPI
      thumbnailUrl?: string
    }
  }
}

export class UazapiClient {
  private baseUrl: string
  private token: string

  constructor(config: UazapiConfig) {
    this.baseUrl = config.instanceUrl.replace(/\/$/, '')
    this.token = config.token
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        token: this.token,
        ...options.headers,
      },
    })

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText)
      throw new Error(`uazapi ${path} → ${res.status}: ${text}`)
    }

    return res.json() as Promise<T>
  }

  // ─── Instância ────────────────────────────────────────────

  async getStatus(): Promise<{
    status: 'disconnected' | 'connecting' | 'connected'
    qrcode?: string
    pairingCode?: string
    phone?: string
  }> {
    const raw: any = await this.request('/instance/status')
    return normalizeInstanceResponse(raw)
  }

  /** Verifica se um ou mais números têm WhatsApp ativo. Usado na extração
   * de leads antes de tentar abordar (evita gastar disparo com número morto). */
  async checkWhatsapp(numbers: string[]): Promise<{ query: string; exists: boolean; jid?: string }[]> {
    const raw: any = await this.request('/chat/check', {
      method: 'POST',
      body: JSON.stringify({ numbers }),
    })
    return Array.isArray(raw) ? raw : raw?.data ?? []
  }

  async connect(phone?: string): Promise<{
    qrcode?: string
    pairingCode?: string
    status: string
  }> {
    const raw: any = await this.request('/instance/connect', {
      method: 'POST',
      body: JSON.stringify(phone ? { phone } : {}),
    })
    return normalizeInstanceResponse(raw)
  }

  async disconnect(): Promise<void> {
    await this.request('/instance/disconnect', { method: 'POST', body: '{}' })
  }

  // ─── Mensagens ────────────────────────────────────────────

  async sendText(params: UazapiSendTextParams): Promise<{ id: string }> {
    return this.request('/send/text', {
      method: 'POST',
      body: JSON.stringify(params),
    })
  }

  async sendMedia(params: UazapiSendMediaParams): Promise<{ id: string }> {
    return this.request('/send/media', {
      method: 'POST',
      body: JSON.stringify(params),
    })
  }

  async markRead(messageId: string): Promise<void> {
    await this.request('/message/markread', {
      method: 'POST',
      body: JSON.stringify({ id: [messageId] }),
    })
  }

  async downloadMedia(messageId: string): Promise<{ base64Data: string; mimetype: string }> {
    return this.request('/message/download', {
      method: 'POST',
      body: JSON.stringify({ id: messageId, return_base64: true }),
    })
  }

  async blockContact(number: string): Promise<void> {
    await this.request('/chat/block', {
      method: 'POST',
      body: JSON.stringify({ number, block: true }),
    })
  }

  async sendPresence(number: string, presence: 'composing' | 'recording' | 'paused', delay?: number): Promise<void> {
    await this.request('/message/presence', {
      method: 'POST',
      body: JSON.stringify({ number, presence, delay }),
    })
  }

  async reactToMessage(number: string, messageId: string, emoji: string): Promise<void> {
    await this.request('/message/react', {
      method: 'POST',
      body: JSON.stringify({ number, text: emoji, id: messageId }),
    })
  }

  async deleteMessage(messageId: string): Promise<void> {
    await this.request('/message/delete', {
      method: 'POST',
      body: JSON.stringify({ id: messageId }),
    })
  }

  async editMessage(messageId: string, text: string): Promise<void> {
    await this.request('/message/edit', {
      method: 'POST',
      body: JSON.stringify({ id: messageId, text }),
    })
  }

  async pinMessage(messageId: string, pin: boolean, duration = 7): Promise<void> {
    await this.request('/message/pin', {
      method: 'POST',
      body: JSON.stringify({ id: messageId, pin, duration }),
    })
  }

  async sendMenu(params: UazapiSendMenuParams): Promise<{ id: string }> {
    return this.request('/send/menu', {
      method: 'POST',
      body: JSON.stringify(params),
    })
  }

  async sendCarousel(params: UazapiSendCarouselParams): Promise<{ id: string }> {
    return this.request('/send/carousel', {
      method: 'POST',
      body: JSON.stringify(params),
    })
  }

  async sendLocation(params: UazapiSendLocationParams): Promise<{ id: string }> {
    return this.request('/send/location', {
      method: 'POST',
      body: JSON.stringify(params),
    })
  }

  // ─── Webhook ─────────────────────────────────────────────

  async setWebhook(url: string): Promise<void> {
    await this.request('/webhook', {
      method: 'POST',
      body: JSON.stringify({
        url,
        enabled: true,
        events: ['messages', 'connection', 'messages_update'],
        excludeMessages: ['wasSentByApi'], // evita loop: mensagens enviadas pela API não disparam webhook
      }),
    })
  }

  async getWebhook(): Promise<any> {
    return this.request('/webhook')
  }
}

// ─── Factory por empresa ──────────────────────────────────

export function createUazapiClient(instanceUrl: string, token: string): UazapiClient {
  return new UazapiClient({ instanceUrl, token })
}

// ─── Normalização de resposta UAZapi ─────────────────────
// UAZapi pode retornar status como "open"/"close"/"connecting" e
// qrcode em vários campos diferentes dependendo da versão.

function normalizeStatus(raw: unknown): 'connected' | 'connecting' | 'disconnected' {
  if (!raw || typeof raw !== 'string') return 'disconnected'
  const s = raw.toLowerCase()
  if (s === 'open' || s === 'connected' || s === 'authenticated') return 'connected'
  if (s === 'connecting' || s === 'qr' || s === 'pairing') return 'connecting'
  return 'disconnected'
}

function normalizeInstanceResponse(raw: any) {
  // instance.status tem prioridade : raw.status pode ser um objeto { connected, loggedIn, jid }
  const statusStr =
    raw?.instance?.status ||
    raw?.state ||
    (typeof raw?.status === 'string' ? raw.status : null)

  const status = normalizeStatus(statusStr)

  // qrcode dentro de instance (formato real da UAZapi)
  const qrcode =
    raw?.instance?.qrcode ||
    raw?.qrcode ||
    raw?.qr_code ||
    raw?.qr ||
    raw?.base64 ||
    null

  const pairingCode =
    raw?.instance?.paircode ||
    raw?.pairingCode ||
    raw?.paircode ||
    raw?.pairing_code ||
    null

  // jid pode estar em raw.status.jid (GET /instance/status) ou raw.jid (connect)
  const jid =
    raw?.status?.jid ||
    raw?.jid ||
    raw?.instance?.jid ||
    null

  const phone = jid
    ? jid.replace('@s.whatsapp.net', '')
    : raw?.phone || raw?.number || raw?.instance?.phone || null

  return { status, qrcode, pairingCode, phone }
}

// ─── Helpers ─────────────────────────────────────────────

/** Normaliza número BR para formato uazapi (apenas dígitos, com DDI 55 e dígito 9) */
export function normalizePhone(raw: string): string {
  let n = raw.replace('@s.whatsapp.net', '').replace(/\D/g, '')
  if (!n.startsWith('55')) n = '55' + n
  if (n.length === 12) n = n.slice(0, 4) + '9' + n.slice(4)
  return n
}

/** Despacha mensagem rica de um step de follow-up */
export async function sendRichStep(
  client: UazapiClient,
  number: string,
  tipo: StepTipoMensagem,
  mensagem: string,
  media?: StepMediaConfig
): Promise<void> {
  switch (tipo) {
    case 'text':
      await client.sendText({ number, text: mensagem })
      break

    case 'image':
    case 'video':
    case 'document':
    case 'audio':
    case 'ptt':
    case 'sticker':
      if (!media?.file) throw new Error(`sendRichStep: tipo ${tipo} requer media.file`)
      await client.sendMedia({
        number,
        type: tipo,
        file: media.file,
        text: tipo !== 'sticker' ? media.text : undefined,
        docName: media.docName,
        viewOnce: media.viewOnce,
      })
      break

    case 'menu':
      if (!media?.choices?.length) throw new Error('sendRichStep: menu requer media.choices')
      await client.sendMenu({
        number,
        type: media.menuType ?? 'button',
        text: mensagem,
        choices: media.choices,
        selectableCount: media.selectableCount,
      })
      break

    case 'carousel':
      if (!media?.carousel?.length) throw new Error('sendRichStep: carousel requer media.carousel')
      await client.sendCarousel({ number, text: mensagem, carousel: media.carousel })
      break

    case 'location':
      if (media?.latitude == null || media?.longitude == null)
        throw new Error('sendRichStep: location requer latitude e longitude')
      await client.sendLocation({
        number,
        name: media.name ?? mensagem,
        address: media.address ?? '',
        latitude: media.latitude,
        longitude: media.longitude,
      })
      break

    default:
      await client.sendText({ number, text: mensagem })
  }
}

/** Detecta tipo de mensagem do payload uazapi */
export function detectMessageType(msg: UazapiWebhookMessage['message']): 'text' | 'audio' | 'image' | 'document' | 'video' | 'unknown' {
  const mime = msg.content?.mimetype ?? ''
  if (mime.startsWith('audio')) return 'audio'
  if (mime.startsWith('image')) return 'image'
  if (mime === 'application/pdf') return 'document'
  if (mime.startsWith('video')) return 'video'
  if (msg.text) return 'text'
  return 'unknown'
}
