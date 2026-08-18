import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { createServiceClient } from '@/lib/supabase/server'
import { encrypt } from '@/lib/crypto'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const { context, error: authError } = await requireAuth(req)
    if (authError) return authError

    const { code, phoneNumberId, wabaId, coex } = await req.json()
    if (!code || !wabaId) {
      return NextResponse.json({ error: 'code e wabaId são obrigatórios' }, { status: 400 })
    }

    const appId = process.env.NEXT_PUBLIC_META_APP_ID
    const appSecret = process.env.META_APP_SECRET
    if (!appId || !appSecret) {
      return NextResponse.json({ error: 'META_APP_ID ou META_APP_SECRET não configurado' }, { status: 500 })
    }

    // Troca o code (TTL 30s) por business integration system user token
    const tokenRes = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&code=${code}`
    )
    const tokenJson = await tokenRes.json()
    if (!tokenRes.ok || !tokenJson.access_token) {
      console.error('[meta/connect] token exchange error:', tokenJson)
      return NextResponse.json({ error: 'Falha ao trocar code por token Meta', detail: tokenJson?.error?.message }, { status: 400 })
    }
    const longToken: string = tokenJson.access_token

    // Busca número de telefone da WABA
    let finalPhoneNumberId = phoneNumberId
    let phone: string = phoneNumberId ?? wabaId

    if (coex || !phoneNumberId) {
      const numbersRes = await fetch(
        `https://graph.facebook.com/v21.0/${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name&access_token=${longToken}`
      )
      const numbersJson = await numbersRes.json()
      const numbers: any[] = numbersJson.data ?? []
      console.log(`[meta/connect] WABA ${wabaId} : números:`, numbers.map((n: any) => n.display_phone_number))
      if (numbers.length > 0) {
        finalPhoneNumberId = numbers[0].id
        phone = numbers[0].display_phone_number ?? numbers[0].id
      }
    } else {
      const phoneRes = await fetch(
        `https://graph.facebook.com/v21.0/${phoneNumberId}?fields=display_phone_number,verified_name&access_token=${longToken}`
      )
      const phoneJson = await phoneRes.json()
      phone = phoneJson.display_phone_number ?? phoneNumberId
    }

    // Inscreve a WABA no webhook do app (obrigatório para receber mensagens)
    console.log(`[meta/connect] chamando subscribed_apps para wabaId=${wabaId}`)
    const wabaSubRes = await fetch(
      `https://graph.facebook.com/v21.0/${wabaId}/subscribed_apps`,
      { method: 'POST', headers: { Authorization: `Bearer ${longToken}` } }
    )
    const wabaSubJson = await wabaSubRes.json()
    console.log(`[meta/connect] subscribed_apps status=${wabaSubRes.status} response=${JSON.stringify(wabaSubJson)}`)
    if (!wabaSubRes.ok) {
      console.error(`[meta/connect] ERRO subscribed_apps : ${JSON.stringify(wabaSubJson)}`)
    } else {
      console.log(`[meta/connect] WABA ${wabaId} inscrita com sucesso`)
    }

    // Salva na sdr_configs
    const supabase = createServiceClient()
    const { error: dbErr } = await supabase
      .from('sdr_configs')
      .update({
        whatsapp_provider: 'meta',
        meta_wa_phone_number_id: finalPhoneNumberId,
        meta_wa_waba_id: wabaId,
        meta_wa_token: encrypt(longToken),
      })
      .eq('company_id', context.companyId)

    if (dbErr) {
      console.error('[meta/connect] db error:', dbErr)
      return NextResponse.json({ error: 'Erro ao salvar configuração' }, { status: 500 })
    }

    console.log(`[meta/connect] empresa ${context.companyId} conectada : wabaId=${wabaId} phone=${phone}`)
    return NextResponse.json({ ok: true, phone, token: longToken, phoneNumberId: finalPhoneNumberId, wabaId })
  } catch (e: any) {
    console.error('[meta/connect] unhandled error:', e)
    return NextResponse.json({ error: e?.message ?? 'Erro interno' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const { context, error: authError } = await requireAuth(req)
  if (authError) return authError

  console.log(`[meta/connect:DELETE] desconectando companyId=${context.companyId}`)
  const supabase = createServiceClient()
  const { error: dbErr } = await supabase
    .from('sdr_configs')
    .update({
      whatsapp_provider: 'uazapi',
      meta_wa_phone_number_id: null,
      meta_wa_waba_id: null,
      meta_wa_token: null,
    })
    .eq('company_id', context.companyId)

  if (dbErr) {
    console.error(`[meta/connect:DELETE] ERRO : ${dbErr.message}`)
    return NextResponse.json({ error: dbErr.message }, { status: 500 })
  }

  console.log(`[meta/connect:DELETE] OK : companyId=${context.companyId}`)
  return NextResponse.json({ ok: true })
}
