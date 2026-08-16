import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createServiceClient } from '@/lib/supabase/server'
import { normalizePhone } from '@/lib/sdr/uazapi'
import { persistMediaToStorage } from '@/lib/sdr/media-storage'
import { isPromptInjection, log } from '@/lib/sdr/engine'
import { ingestInboundMessage, type NormalizedInboundEvent } from '@/lib/sdr/inbound'
import { sendInjectionAlertEmail } from '@/lib/email/resend'

export const runtime = 'nodejs'
export const maxDuration = 60

// Resolve um media_id da Cloud API pra bytes reais : a Meta manda só { id, mime_type }
// no webhook, nunca uma URL direta. Precisa de uma chamada extra pro Graph API que
// devolve uma URL temporária (expira em minutos, exige o token no header pra baixar).
async function resolveMetaMedia(mediaId: string, token: string): Promise<{ bytes: Buffer; mimetype: string } | null> {
  try {
    const metaRes = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!metaRes.ok) {
      console.error(`[meta-webhook] resolveMetaMedia falhou ao buscar url : ${metaRes.status}`)
      return null
    }
    const { url, mime_type } = await metaRes.json()
    if (!url) return null

    const fileRes = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (!fileRes.ok) {
      console.error(`[meta-webhook] resolveMetaMedia falhou ao baixar arquivo : ${fileRes.status}`)
      return null
    }
    const bytes = Buffer.from(await fileRes.arrayBuffer())
    return { bytes, mimetype: mime_type || '' }
  } catch (e: any) {
    console.error('[meta-webhook] resolveMetaMedia erro:', e.message)
    return null
  }
}

function mediaKindFor(msgType: string): 'audio' | 'image' | 'document' | 'video' {
  if (msgType === 'audio' || msgType === 'voice') return 'audio'
  if (msgType === 'video') return 'video'
  if (msgType === 'document') return 'document'
  return 'image' // image, sticker
}

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

        // Reação (❤️👍 etc) não é mensagem : ignora, não buffa e não gera resposta do SDR
        if (msgType === 'reaction') {
          console.log(`[meta-webhook] ignorado : reação (emoji=${msg.reaction?.emoji ?? '?'})`)
          continue
        }

        let content = ''
        let mediaUrl: string | undefined
        let metaMediaId: string | undefined

        if (msgType === 'text') {
          content = msg.text?.body ?? ''
        } else if (msgType === 'image') {
          metaMediaId = msg.image?.id
          content = msg.image?.caption ?? '📷 Imagem'
        } else if (msgType === 'video') {
          metaMediaId = msg.video?.id
          content = msg.video?.caption ?? '🎥 Vídeo'
        } else if (msgType === 'audio' || msgType === 'voice') {
          metaMediaId = msg.audio?.id ?? msg.voice?.id
          content = '🎵 Áudio'
        } else if (msgType === 'document') {
          metaMediaId = msg.document?.id
          content = msg.document?.caption ?? msg.document?.filename ?? '📄 Documento'
        } else if (msgType === 'sticker') {
          metaMediaId = msg.sticker?.id
          content = '🎭 Figurinha'
        } else if (msgType === 'location') {
          content = `📍 Localização: ${msg.location?.latitude}, ${msg.location?.longitude}`
        } else {
          content = `[${msgType}]`
        }

        // ── CTWA_CLID: capturado PRIMEIRO, antes de qualquer outro processamento ──
        // RF6.1 do PRD — janela de 7 dias, dado irrecuperável se perdido aqui
        const referral = msg.referral ?? null
        const ctwaClid = referral?.ctwa_clid ?? null

        console.log(`[meta-webhook] msg : companyId=${companyId} from=${from.slice(0, 4)}**** type=${msgType} id=${msgId} ctwa=${ctwaClid ? 'SIM' : 'NAO'}`)

        if (!companyId) continue

        const phone = normalizePhone(from)

        // Resolve o media_id pra bytes reais e sobe pro storage : sem isso mediaUrl
        // fica sempre undefined (a Meta nunca manda url pronta no webhook) e a mídia
        // não aparece nem toca no Atendimento, nem chega pro enriquecimento da IA.
        if (metaMediaId && metaToken) {
          const resolved = await resolveMetaMedia(metaMediaId, metaToken)
          if (resolved) {
            mediaUrl = (await persistMediaToStorage({
              companyId,
              phone,
              bytes: resolved.bytes,
              mimetype: resolved.mimetype,
              kind: mediaKindFor(msgType),
            })) ?? undefined
          }
        }

        // Mesmo bloqueio de prompt injection que já roda pro canal uazapi
        if (msgType === 'text' && content && isPromptInjection(content)) {
          await log(companyId, 'injection_blocked', { text: content }, supabase, phone)
          sendInjectionAlertEmail({
            pushName: value.contacts?.[0]?.profile?.name ?? from,
            senderNumber: phone,
            instanceName: '', // sem equivalente na API oficial : não dá pra bloquear o contato via Graph API
            originalMessage: content,
            classification: 'DIRECT_OVERRIDE',
            riskLevel: 'CRITICAL',
            confidence: 0.95,
            timestamp: new Date().toISOString(),
          }).catch(() => {})
          continue
        }

        const evt: NormalizedInboundEvent = {
          companyId,
          channel: 'meta',
          phone,
          messageId: msgId,
          type: msgType,
          text: content,
          timestamp: new Date().toISOString(),
          senderName: value.contacts?.[0]?.profile?.name ?? undefined,
          mediaUrl,
          referral: referral ? {
            ctwaClid: referral.ctwa_clid ?? null,
            gclid: null,
            sourceId: referral.source_id ?? null,
            sourceUrl: referral.source_url ?? null,
            sourceType: referral.source_type ?? null,
            headline: referral.headline ?? null,
            body: referral.body ?? null,
          } : null,
        }

        const result = await ingestInboundMessage(evt, supabase)
        if (!result.handled) {
          console.log(`[meta-webhook] dedup : msgId=${msgId} já no buffer`)
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
