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

        // ── CTWA_CLID: capturado PRIMEIRO, antes de qualquer outro processamento ──
        // RF6.1 do PRD — janela de 7 dias, dado irrecuperável se perdido aqui
        const referral = msg.referral ?? null
        const ctwaClid = referral?.ctwa_clid ?? null
        const gclid: string | null = null  // capturado via landing page, não via webhook

        console.log(`[meta-webhook] msg : companyId=${companyId} from=${from.slice(0, 4)}**** type=${msgType} id=${msgId} ctwa=${ctwaClid ? 'SIM' : 'NAO'}`)

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

        // Salva imediatamente no chat para aparecer na UI sem esperar o SDR
        const contactName = value.contacts?.[0]?.profile?.name ?? from
        const ts = new Date().toISOString()

        const { data: existingConv } = await supabase
          .from('conversas_do_whatsapp')
          .select('id, contagem_nao_lida, ctwa_clid')
          .eq('company_id', companyId)
          .eq('numero_de_telefone', phone)
          .maybeSingle()

        let convId: string | null = null
        let isNewConversation = false

        if (existingConv?.id) {
          convId = String(existingConv.id)
          const updatePayload: Record<string, unknown> = {
            ultima_mensagem: content,
            hora_da_ultima_mensagem: ts,
            contagem_nao_lida: (existingConv.contagem_nao_lida ?? 0) + 1,
            ultima_mensagem_inbound_at: ts,
          }
          // Só sobrescreve ctwa_clid se ainda não tinha (primeira atribuição ganha)
          if (ctwaClid && !existingConv.ctwa_clid) {
            updatePayload.ctwa_clid = ctwaClid
            updatePayload.attribution_source = 'meta_ctwa'
            updatePayload.window_type = 'ctwa'
            const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()
            updatePayload.window_expires_at = expiresAt
          }
          await supabase
            .from('conversas_do_whatsapp')
            .update(updatePayload)
            .eq('id', existingConv.id)
        } else {
          isNewConversation = true
          const windowExpiresAt = ctwaClid
            ? new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()
            : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

          const { data: created } = await supabase
            .from('conversas_do_whatsapp')
            .insert({
              company_id: companyId,
              numero_de_telefone: phone,
              nome_do_contato: contactName,
              ultima_mensagem: content,
              hora_da_ultima_mensagem: ts,
              status_da_conversa: 'aberto',
              contagem_nao_lida: 1,
              ultima_mensagem_inbound_at: ts,
              ctwa_clid: ctwaClid ?? null,
              gclid: gclid ?? null,
              attribution_source: ctwaClid ? 'meta_ctwa' : 'organic',
              kanban_stage: 'novo',
              current_status: 'sdr',
              window_type: ctwaClid ? 'ctwa' : 'regular',
              window_expires_at: windowExpiresAt,
            })
            .select('id')
            .single()
          convId = created ? String(created.id) : null
        }

        if (convId && msgId) {
          const { data: alreadySaved } = await supabase
            .from('mensagens_do_whatsapp')
            .select('id')
            .eq('whatsapp_message_id', msgId)
            .maybeSingle()

          if (!alreadySaved) {
            await supabase.from('mensagens_do_whatsapp').insert({
              company_id: companyId,
              id_da_conversacao: convId,
              texto_da_mensagem: content,
              tipo_de_mensagem: msgType,
              direcao: 'inbound',
              sender_type: 'lead',
              carimbo_de_data_e_hora: ts,
              url_da_midia: mediaUrl ?? null,
              whatsapp_message_id: msgId,
            })
            console.log(`[meta-webhook] mensagem salva na UI : convId=${convId}`)
          } else {
            console.log(`[meta-webhook] mensagem já existe no DB : msgId=${msgId}`)
          }

          // Salva attribution_event se veio de CTWA (ou ao criar conversa nova como orgânico)
          if (isNewConversation) {
            const attrSource = ctwaClid ? 'meta_ctwa' : 'organic'
            const windowType = ctwaClid ? 'meta_ctwa_72h' : 'organic_free'
            await supabase.from('attribution_events').insert({
              conversation_id: convId,
              source: attrSource,
              ctwa_clid: ctwaClid ?? null,
              gclid: gclid ?? null,
              campaign_id: referral?.source_id ?? null,
              referral_source_url: referral?.source_url ?? null,
              referral_source_type: referral?.source_type ?? null,
              referral_headline: referral?.headline ?? null,
              referral_body: referral?.body ?? null,
              window_type: windowType,
            })
            console.log(`[meta-webhook] attribution_event salvo : source=${attrSource} ctwa=${ctwaClid ? 'SIM' : 'NAO'}`)
          }
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
