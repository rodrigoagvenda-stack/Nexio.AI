import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import webpush from 'web-push'

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY
const VAPID_EMAIL = process.env.VAPID_EMAIL || 'mailto:suporte@zaapply.com.br'

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE)
}

export async function POST(req: NextRequest) {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    return NextResponse.json({ ok: false, note: 'VAPID keys não configuradas' })
  }

  const body = await req.json()
  const { attendant_id, title, message, url } = body

  if (!attendant_id) {
    return NextResponse.json({ error: 'attendant_id obrigatório' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('endpoint, keys_p256dh, keys_auth')
    .eq('attendant_id', attendant_id)

  if (!subs || subs.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 })
  }

  const payload = JSON.stringify({
    title: title || 'Zaapply',
    body: message || '',
    url: url || '/atendimento',
    tag: `zaapply-${Date.now()}`,
  })

  let sent = 0
  const errors: string[] = []

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth },
        },
        payload
      )
      sent++
    } catch (err: any) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        // subscription expired — remove it
        await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
      } else {
        errors.push(err.message)
      }
    }
  }

  return NextResponse.json({ ok: true, sent, errors })
}
