import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { createServiceClient } from '@/lib/supabase/server'
import crypto from 'crypto'

export const runtime = 'nodejs'

// POST /api/meta/capi : dispara evento de conversão para o Pixel via Conversions API
export async function POST(req: NextRequest) {
  try {
    const { context, error: authError } = await requireAuth(req)
    if (authError) return authError

    const { conversaId, eventName = 'Purchase', value, currency = 'BRL' } = await req.json()
    if (!conversaId) {
      return NextResponse.json({ error: 'conversaId obrigatório' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Busca config do Pixel
    const { data: config } = await supabase
      .from('sdr_configs')
      .select('meta_pixel_id, meta_pixel_token')
      .eq('company_id', context.companyId)
      .single()

    if (!config?.meta_pixel_id || !config?.meta_pixel_token) {
      return NextResponse.json({ ok: false, skipped: true, reason: 'Pixel não configurado' })
    }

    // Busca dados da conversa para enriquecer o evento
    const { data: conversa } = await supabase
      .from('conversas_do_whatsapp')
      .select('numero_de_telefone, lead_source, window_type')
      .eq('id', conversaId)
      .eq('company_id', context.companyId)
      .single()

    if (!conversa) {
      return NextResponse.json({ error: 'Conversa não encontrada' }, { status: 404 })
    }

    const phone = conversa.numero_de_telefone?.replace(/\D/g, '') ?? ''
    const ctwaClid = (conversa.lead_source as any)?.ctwa_clid ?? undefined

    // Hash do telefone para user_data (requisito Meta CAPI)
    const phoneHash = phone
      ? crypto.createHash('sha256').update(phone).digest('hex')
      : undefined

    const eventTime = Math.floor(Date.now() / 1000)
    const eventId = `zaapply_${conversaId}_${eventTime}`

    const payload = {
      data: [{
        event_name: eventName,
        event_time: eventTime,
        event_id: eventId,
        action_source: 'business_messaging',
        messaging_channel: 'whatsapp',
        user_data: {
          ...(phoneHash ? { ph: [phoneHash] } : {}),
          ...(ctwaClid ? { ctwa_clid: ctwaClid } : {}),
        },
        ...(value !== undefined ? {
          custom_data: { value, currency }
        } : {}),
      }],
    }

    const res = await fetch(
      `https://graph.facebook.com/v21.0/${config.meta_pixel_id}/events?access_token=${config.meta_pixel_token}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    )

    const json = await res.json()

    if (!res.ok) {
      console.error('[CAPI] erro Meta:', json)
      return NextResponse.json({ error: 'Falha no CAPI', detail: json?.error?.message }, { status: 400 })
    }

    console.log(`[CAPI] evento ${eventName} enviado : conversa=${conversaId} pixel=${config.meta_pixel_id}`)
    return NextResponse.json({ ok: true, events_received: json.events_received })
  } catch (e: any) {
    console.error('[CAPI] erro:', e)
    return NextResponse.json({ error: e?.message ?? 'Erro interno' }, { status: 500 })
  }
}
