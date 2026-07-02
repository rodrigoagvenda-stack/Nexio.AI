import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { createServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const { context, error: authError } = await requireAuth(req)
  if (authError) return authError

  const { shortToken, phoneNumberId, wabaId } = await req.json()
  if (!shortToken || !phoneNumberId || !wabaId) {
    return NextResponse.json({ error: 'shortToken, phoneNumberId e wabaId são obrigatórios' }, { status: 400 })
  }

  const appId = process.env.NEXT_PUBLIC_META_APP_ID
  const appSecret = process.env.META_APP_SECRET
  if (!appId || !appSecret) {
    return NextResponse.json({ error: 'META_APP_ID ou META_APP_SECRET não configurado' }, { status: 500 })
  }

  // Troca o short-lived token por long-lived token (60 dias)
  const tokenRes = await fetch(
    `https://graph.facebook.com/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortToken}`
  )
  const tokenJson = await tokenRes.json()
  if (!tokenRes.ok || !tokenJson.access_token) {
    console.error('[meta/connect] token exchange error:', tokenJson)
    return NextResponse.json({ error: 'Falha ao trocar token Meta' }, { status: 502 })
  }
  const longToken: string = tokenJson.access_token

  // Busca o número de telefone para exibir ao usuário
  const phoneRes = await fetch(
    `https://graph.facebook.com/v21.0/${phoneNumberId}?fields=display_phone_number,verified_name&access_token=${longToken}`
  )
  const phoneJson = await phoneRes.json()
  const phone: string = phoneJson.display_phone_number ?? phoneNumberId

  // Inscreve o número no webhook do app
  const webhookRes = await fetch(
    `https://graph.facebook.com/v21.0/${phoneNumberId}/subscribed_apps`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${longToken}` },
    }
  )
  if (!webhookRes.ok) {
    const webhookErr = await webhookRes.text()
    console.warn('[meta/connect] webhook subscribe warn:', webhookErr)
    // Não bloqueia — pode já estar inscrito
  }

  // Salva na sdr_configs
  const supabase = createServiceClient()
  const { error: dbErr } = await supabase
    .from('sdr_configs')
    .update({
      whatsapp_provider: 'meta',
      meta_wa_phone_number_id: phoneNumberId,
      meta_wa_waba_id: wabaId,
      meta_wa_token: longToken,
    })
    .eq('company_id', context.companyId)

  if (dbErr) {
    console.error('[meta/connect] db error:', dbErr)
    return NextResponse.json({ error: 'Erro ao salvar configuração' }, { status: 500 })
  }

  console.log(`[meta/connect] empresa ${context.companyId} conectada via CoEx — phone=${phone}`)
  return NextResponse.json({ ok: true, phone, token: longToken })
}

// DELETE — desconecta Meta WhatsApp
export async function DELETE(req: NextRequest) {
  const { context, error: authError } = await requireAuth(req)
  if (authError) return authError

  const supabase = createServiceClient()
  await supabase
    .from('sdr_configs')
    .update({
      whatsapp_provider: 'uazapi',
      meta_wa_phone_number_id: null,
      meta_wa_waba_id: null,
      meta_wa_token: null,
    })
    .eq('company_id', context.companyId)

  return NextResponse.json({ ok: true })
}
