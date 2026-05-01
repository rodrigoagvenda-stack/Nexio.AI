/**
 * Cliente uazapi — abstrai todas as chamadas HTTP para a API da uazapi.
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
  type: 'image' | 'video' | 'document' | 'audio' | 'ptt'
  file: string
  text?: string
  docName?: string
  delay?: number
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

  // ─── Webhook ─────────────────────────────────────────────

  async setWebhook(url: string): Promise<void> {
    await this.request('/webhook', {
      method: 'POST',
      body: JSON.stringify({
        url,
        enabled: true,
        // Sem filtro de eventos — recebe tudo (ReceivedCallback, SentCallback, ConnectionUpdate, etc.)
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
  // instance.status tem prioridade — raw.status pode ser um objeto { connected, loggedIn, jid }
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
