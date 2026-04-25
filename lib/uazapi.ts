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
    // Tenta múltiplos formatos que a uazapi pode enviar
    const data = body?.data ?? body

    // fromMe — ignora mensagens enviadas pela própria instância
    const fromMe = data?.key?.fromMe ?? body?.fromMe ?? false
    if (fromMe) return null

    // remoteJid (número do remetente)
    const remoteJid: string =
      data?.key?.remoteJid ??
      body?.from ??
      body?.sender ??
      ""

    // Ignora grupos
    if (remoteJid.includes("@g.us") || remoteJid.includes("@newsletter")) return null

    const fromNumber = remoteJid.replace("@s.whatsapp.net", "").replace("@lid", "")
    if (!fromNumber) return null

    // Texto da mensagem
    const text: string =
      data?.message?.conversation ??
      data?.message?.extendedTextMessage?.text ??
      data?.message?.buttonsResponseMessage?.selectedButtonId ??
      data?.message?.listResponseMessage?.singleSelectReply?.selectedRowId ??
      data?.message?.templateButtonReplyMessage?.selectedId ??
      body?.body ??
      body?.text ??
      ""

    if (!text) return null

    // ID da mensagem
    const msgId: string = data?.key?.id ?? body?.id ?? ""

    // Nome do remetente
    const pushName: string = data?.pushName ?? body?.pushName ?? body?.name ?? ""

    // Instância
    const instanceName: string = body?.instance ?? body?.instanceId ?? body?.instanceName ?? ""

    return { fromNumber, text, msgId, pushName, fromMe: false, instanceName }
  } catch {
    return null
  }
}
