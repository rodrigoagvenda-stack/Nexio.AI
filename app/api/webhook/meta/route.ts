import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createServiceClient } from '@/lib/supabase/server'
import { normalizePhone } from '@/lib/sdr/uazapi'

export const runtime = 'nodejs'
export const maxDuration = 60

// GET : verificação do webhook pela Meta
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  console.log(`[meta-webhook:GET] mode=${mode} token_ok=${token === process.env.META_WEBHOOK_VERIFY_TOKEN} challenge=${challenge?.slice(0, 10)}`)

  const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN
  if (mode === 'subscribe' && token === verifyToken) {
    console.log('[meta-webhook:GET] verificação OK — respondendo challenge')
    return new NextResponse(challenge, { status: 200 })
  }

  console.warn('[meta-webhook:GET] verificação falhou : token inválido ou mode errado')
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

async function markMetaRead(phoneNumberId: string, token: string, messageId: string) {
  fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', status: 'read', message_id: messageId }),
  }).catch(() => {})
}

// POST : recebe eventos da Meta (mensagens, status, etc.)
export async function POST(req: NextRequest) {
  console.log(`[meta-webhook:POST] requisição recebida — ${new Date().toISOString()}`)

  const rawBody = await req.text()
  console.log(`[meta-webhook:POST] body length=${rawBody.length} x-hub-signature-256=${req.headers.get('x-hub-signature-256')?.slice(0, 20)}...`)

  const appSecret = process.env.META_APP_SECRET
  if (!appSecret) {
    console.error('[meta-webhook:POST] META_APP_SECRET não configurado')
    return NextResponse.json({ error: 'Webhook não configurado' }, { status: 500 })
  }

  const sig = req.headers.get('x-hub-signature-256') ?? ''
  const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex')
  if (!sig || sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    console.error(`[meta-webhook:POST] ASSINATURA INVÁLIDA — sig recebida: ${sig.slice(0, 30)} | expected: ${expected.slice(0, 30)}`)
    return NextResponse.json({ error: 'Assinatura inválida' }, { status: 401 })
  }
  console.log('[meta-webhook:POST] assinatura OK')

  let body: any
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  console.log('[meta-webhook] evento recebido:', JSON.stringify(body).slice(0, 500))

  const supabase = createServiceClient()
  const entries: any[] = body?.entry ?? []

  for (const entry of entries) {
    for (const change of entry.changes ?? []) {
      const value = change.value
      const phoneNumberId: string = value?.metadata?.phone_number_id ?? ''
      const messages: any[] = value?.messages ?? []
      const statuses: any[] = value?.statuses ?? []

      let companyId: number | null = null
      let metaToken: string | null = null

      if (phoneNumberId) {
        const { data: config } = await supabase
          .from('sdr_configs')
          .select('company_id, meta_wa_token')
          .eq('meta_wa_phone_number_id', phoneNumberId)
          .maybeSingle()

        if (config) {
          companyId = config.company_id
          metaToken = config.meta_wa_token
          console.log(`[meta-webhook] empresa resolvida : companyId=${companyId} phoneNumberId=${phoneNumberId}`)
        } else {
          console.warn(`[meta-webhook] phoneNumberId=${phoneNumberId} não encontrado em sdr_configs`)
        }
      }

      for (const msg of messages) {
        const from: string = msg.from ?? ''
        const msgId: string = msg.id ?? ''
        const msgType: string = msg.type ?? 'text'

        let content = ''
        let mediaUrl: string | undefined

        if (msgType === 'text') {
          content = msg.text?.body ?? ''
        } else if (msgType === 'image') {
          mediaUrl = msg.image?.url
          content = msg.image?.caption ?? '📷 Imagem'
        } else if (msgType === 'video') {
          mediaUrl = msg.video?.url
          content = msg.video?.caption ?? '🎥 Vídeo'
        } else if (msgType === 'audio' || msgType === 'voice') {
          mediaUrl = msg.audio?.url ?? msg.voice?.url
          content = '🎵 Áudio'
        } else if (msgType === 'document') {
          mediaUrl = msg.document?.url
          content = msg.document?.caption ?? msg.document?.filename ?? '📄 Documento'
        } else if (msgType === 'sticker') {
          mediaUrl = msg.sticker?.url
          content = '🎭 Figurinha'
        } else if (msgType === 'location') {
          content = `📍 Localização: ${msg.location?.latitude}, ${msg.location?.longitude}`
        } else {
          content = `[${msgType}]`
        }

        console.log(`[meta-webhook] msg : companyId=${companyId} from=${from.slice(0, 4)}**** type=${msgType} id=${msgId}`)

        if (!companyId) continue

        const phone = normalizePhone(from)

        // Dedup por messageId
        const { data: existing } = await supabase
          .from('sdr_message_buffer')
          .select('messages')
          .eq('company_id', companyId)
          .eq('phone', phone)
          .maybeSingle()

        if (existing?.messages) {
          const buffered = existing.messages as any[]
          if (buffered.some((m: any) => m.messageId === msgId)) {
            console.log(`[meta-webhook] dedup : msgId=${msgId} já no buffer`)
            continue
          }
        }

        const bufferedMsg = {
          content,
          type: msgType,
          timestamp: new Date().toISOString(),
          messageId: msgId,
          mediaUrl,
        }

        const expiresAt = new Date(Date.now() + 30_000).toISOString()

        if (existing) {
          await supabase
            .from('sdr_message_buffer')
            .update({ messages: [...(existing.messages as any[]), bufferedMsg], expires_at: expiresAt })
            .eq('company_id', companyId)
            .eq('phone', phone)
        } else {
          await supabase.from('sdr_message_buffer').insert({
            company_id: companyId,
            phone,
            messages: [bufferedMsg],
            expires_at: expiresAt,
          })
        }

        const { error: jobErr } = await supabase.from('sdr_jobs').upsert(
          {
            company_id: companyId,
            phone,
            status: 'PENDING',
            last_message_at: new Date().toISOString(),
            attempts: 0,
          },
          { onConflict: 'company_id,phone', ignoreDuplicates: false }
        )

        if (jobErr) {
          console.error(`[meta-webhook] ERRO job : companyId=${companyId} phone=${phone.slice(0, 6)}**** : ${jobErr.message}`)
        } else {
          console.log(`[meta-webhook] job upserted : companyId=${companyId} phone=${phone.slice(0, 6)}****`)
        }

        if (metaToken && msgId) markMetaRead(phoneNumberId, metaToken, msgId)
      }

      for (const status of statuses) {
        const waId: string = status.id ?? ''
        const newStatus: string = status.status ?? ''
        console.log(`[meta-webhook] status : waId=${waId} status=${newStatus}`)

        if (waId && (newStatus === 'delivered' || newStatus === 'read' || newStatus === 'failed')) {
          await supabase
            .from('mensagens_do_whatsapp')
            .update({ status: newStatus })
            .eq('whatsapp_message_id', waId)
        }
      }
    }
  }

  return NextResponse.json({ ok: true }, { status: 200 })
}
