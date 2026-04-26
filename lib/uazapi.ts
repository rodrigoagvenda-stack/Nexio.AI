// ─── uazapi client — baseado na documentação oficial ─────────────────────────
// Base URL: https://nexioai.uazapi.com (instância no subdomínio)
// Auth: header "token: SEU_TOKEN"

export interface UazapiConfig {
  base_url: string   // ex: https://nexioai.uazapi.com
  token: string
}

function headers(token: string) {
  return {
    "token": token,
    "Content-Type": "application/json",
  }
}

function base(cfg: UazapiConfig) {
  return cfg.base_url.replace(/\/+$/, "").replace(/^(https?:\/\/)https?:\/\//, "$1")
}

// ── Texto simples ──────────────────────────────────────────────────────────────
export async function sendText(cfg: UazapiConfig, number: string, text: string, opts?: {
  delay?: number
  readchat?: boolean
}) {
  const res = await fetch(`${base(cfg)}/send/text`, {
    method: "POST",
    headers: headers(cfg.token),
    body: JSON.stringify({ number, text, delay: opts?.delay ?? 1200, readchat: opts?.readchat }),
    signal: AbortSignal.timeout(12000),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json?.error ?? `uazapi ${res.status}`)
  return json
}

// ── Botões interativos ─────────────────────────────────────────────────────────
export async function sendButtons(cfg: UazapiConfig, number: string, opts: {
  text: string
  choices: string[]   // ex: ["Confirmar|confirmar", "Não posso|nao_posso"]
  footer?: string
  image?: string
  delay?: number
}) {
  const res = await fetch(`${base(cfg)}/send/menu`, {
    method: "POST",
    headers: headers(cfg.token),
    body: JSON.stringify({
      number,
      type: "button",
      text: opts.text,
      choices: opts.choices,
      footerText: opts.footer,
      imageButton: opts.image,
      delay: opts.delay ?? 1200,
      readchat: true,
    }),
    signal: AbortSignal.timeout(12000),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json?.error ?? `uazapi ${res.status}`)
  return json
}

// ── Lista interativa ───────────────────────────────────────────────────────────
export async function sendList(cfg: UazapiConfig, number: string, opts: {
  text: string
  listButton: string
  choices: string[]   // ex: ["[Seção]", "Item|id|desc"]
  footer?: string
  delay?: number
}) {
  const res = await fetch(`${base(cfg)}/send/menu`, {
    method: "POST",
    headers: headers(cfg.token),
    body: JSON.stringify({
      number,
      type: "list",
      text: opts.text,
      listButton: opts.listButton,
      choices: opts.choices,
      footerText: opts.footer,
      delay: opts.delay ?? 1200,
      readchat: true,
    }),
    signal: AbortSignal.timeout(12000),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json?.error ?? `uazapi ${res.status}`)
  return json
}

// ── Enquete ────────────────────────────────────────────────────────────────────
export async function sendPoll(cfg: UazapiConfig, number: string, opts: {
  text: string
  choices: string[]
  selectableCount?: number
  delay?: number
}) {
  const res = await fetch(`${base(cfg)}/send/menu`, {
    method: "POST",
    headers: headers(cfg.token),
    body: JSON.stringify({
      number,
      type: "poll",
      text: opts.text,
      choices: opts.choices,
      selectableCount: opts.selectableCount ?? 1,
      delay: opts.delay ?? 1200,
      readchat: true,
    }),
    signal: AbortSignal.timeout(12000),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json?.error ?? `uazapi ${res.status}`)
  return json
}

// ── Mídia ──────────────────────────────────────────────────────────────────────
export async function sendMedia(cfg: UazapiConfig, number: string, opts: {
  type: "image" | "video" | "audio" | "document" | "ptt"
  file: string        // URL ou base64
  text?: string       // caption
  docName?: string
  delay?: number
}) {
  const res = await fetch(`${base(cfg)}/send/media`, {
    method: "POST",
    headers: headers(cfg.token),
    body: JSON.stringify({
      number,
      type: opts.type,
      file: opts.file,
      text: opts.text,
      docName: opts.docName,
      delay: opts.delay ?? 1200,
      readchat: true,
    }),
    signal: AbortSignal.timeout(20000),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json?.error ?? `uazapi ${res.status}`)
  return json
}

// ── Localização ───────────────────────────────────────────────────────────────
export async function sendLocation(cfg: UazapiConfig, number: string, opts: {
  name: string
  address: string
  latitude: number
  longitude: number
  delay?: number
}) {
  const res = await fetch(`${base(cfg)}/send/location`, {
    method: "POST",
    headers: headers(cfg.token),
    body: JSON.stringify({
      number,
      name: opts.name,
      address: opts.address,
      latitude: opts.latitude,
      longitude: opts.longitude,
      delay: opts.delay ?? 1500,
    }),
    signal: AbortSignal.timeout(10000),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json?.error ?? `uazapi ${res.status}`)
  return json
}

// ── Reação ─────────────────────────────────────────────────────────────────────
export async function sendReaction(cfg: UazapiConfig, number: string, msgId: string, emoji: string) {
  const res = await fetch(`${base(cfg)}/message/react`, {
    method: "POST",
    headers: headers(cfg.token),
    body: JSON.stringify({ number: `${number}@s.whatsapp.net`, text: emoji, id: msgId }),
    signal: AbortSignal.timeout(8000),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json?.error ?? `uazapi ${res.status}`)
  return json
}

// ── Rejeitar chamada ───────────────────────────────────────────────────────────
export async function rejectCall(cfg: UazapiConfig, number?: string, callId?: string) {
  const res = await fetch(`${base(cfg)}/call/reject`, {
    method: "POST",
    headers: headers(cfg.token),
    body: JSON.stringify(number || callId ? { number, id: callId } : {}),
    signal: AbortSignal.timeout(8000),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json?.error ?? `uazapi ${res.status}`)
  return json
}

// ── Teste de conexão ───────────────────────────────────────────────────────────
export async function testConnection(cfg: UazapiConfig): Promise<{ ok: boolean; detail?: any }> {
  try {
    const res = await fetch(`${base(cfg)}/message/find`, {
      method: "POST",
      headers: headers(cfg.token),
      body: JSON.stringify({ limit: 1 }),
      signal: AbortSignal.timeout(8000),
    })
    const json = await res.json().catch(() => ({}))
    return { ok: res.ok || res.status === 200, detail: json }
  } catch (e: any) {
    return { ok: false, detail: e.message }
  }
}

// ── Parser de webhook recebido ─────────────────────────────────────────────────
export interface IncomingMessage {
  fromNumber: string   // ex: 5511999999999
  text: string
  msgId?: string
  pushName?: string
  fromMe: boolean
  instanceName?: string
}

export function parseWebhookPayload(body: any): IncomingMessage | null {
  try {
    // ── Formato uazapi real (confirmado no GTPRO) ─────────────────────────────
    // { BaseUrl, EventType, chat: { wa_chatid, wa_name, ... }, message: { chatid, fromMe, content, text, ... } }
    if (body?.message && body?.chat) {
      const m    = body.message
      const chat = body.chat

      if (m.fromMe) return null

      // Número do remetente
      const rawId: string = m.chatid ?? chat.wa_chatid ?? ""
      const fromNumber = rawId.replace("@s.whatsapp.net", "").replace("@c.us", "").replace(/\D/g, "")
      if (!fromNumber || fromNumber.length < 8) return null

      // Ignora grupos
      if (rawId.includes("@g.us")) return null

      // Texto — content pode ser string ou objeto (botão/lista)
      let text = ""
      const buttonId: string | undefined = m.buttonOrListid || undefined

      if (typeof m.content === "string") {
        text = m.content
      } else if (m.content && typeof m.content === "object") {
        text = m.content.selectedDisplayText ?? m.content.selectedID ?? ""
      } else if (typeof m.text === "string") {
        text = m.text
      }

      // Se não tem texto mas tem buttonId, usa o buttonId como texto
      if (!text && buttonId) text = buttonId

      if (!text?.trim()) return null

      const pushName     = m.senderName ?? chat.wa_contactName ?? chat.wa_name ?? ""
      const instanceName = body.instanceName ?? body.BaseUrl?.replace("https://", "").split(".")[0] ?? ""

      return { fromNumber, text: text.trim(), msgId: m.id ?? m.messageid ?? "", pushName, fromMe: false, instanceName }
    }

    // ── Formato Evolution API / fallback ──────────────────────────────────────
    const data = body?.data ?? body
    if (data?.key?.fromMe ?? body?.fromMe) return null

    const remoteJid: string = data?.key?.remoteJid ?? body?.from ?? body?.sender ?? ""
    if (!remoteJid || remoteJid.includes("@g.us")) return null

    const fromNumber = remoteJid.replace("@s.whatsapp.net", "").replace("@lid", "").replace(/\D/g, "")
    if (!fromNumber) return null

    const msg = data?.message ?? {}
    const text: string =
      msg?.conversation ??
      msg?.extendedTextMessage?.text ??
      msg?.buttonsResponseMessage?.selectedDisplayText ??
      msg?.listResponseMessage?.title ??
      body?.body ?? body?.text ?? ""

    if (!text?.trim()) return null

    return {
      fromNumber,
      text: text.trim(),
      msgId: data?.key?.id ?? "",
      pushName: data?.pushName ?? "",
      fromMe: false,
      instanceName: body?.instance ?? body?.instanceName ?? "",
    }
  } catch {
    return null
  }
}
