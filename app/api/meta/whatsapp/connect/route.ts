import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { createServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
  const { context, error: authError } = await requireAuth(req)
  if (authError) return authError

  const { code, phoneNumberId, wabaId, coex } = await req.json()
  if (!code) {
    return NextResponse.json({ error: 'code é obrigatório' }, { status: 400 })
  }

  const appId = process.env.NEXT_PUBLIC_META_APP_ID
  const appSecret = process.env.META_APP_SECRET
  if (!appId || !appSecret) {
    return NextResponse.json({ error: 'META_APP_ID ou META_APP_SECRET não configurado' }, { status: 500 })
  }

  // Troca o code (TTL 30s) por business integration system user token (longa duração)
  const tokenRes = await fetch(
    `https://graph.facebook.com/v21.0/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&code=${code}`
  )
  const tokenJson = await tokenRes.json()
  if (!tokenRes.ok || !tokenJson.access_token) {
    console.error('[meta/connect] token exchange error:', tokenJson)
    return NextResponse.json({ error: 'Falha ao trocar code por token Meta' }, { status: 400 })
  }
  const longToken: string = tokenJson.access_token

  // Descobre WABA: usa wabaId do FINISH event, ou auto-discover via /me/businesses
  let finalWabaId: string = wabaId ?? ''
  if (!finalWabaId) {
    console.log('[meta/connect] wabaId não fornecido — auto-discover via /me/businesses')
    const bizRes = await fetch(
      `https://graph.facebook.com/v21.0/me/businesses?fields=id,name&access_token=${longToken}`
    )
    const bizJson = await bizRes.json()
    const businesses: any[] = bizJson.data ?? []
    console.log('[meta/connect] businesses encontrados:', businesses.map((b: any) => `${b.name}(${b.id})`))

    for (const biz of businesses) {
      const wabaListRes = await fetch(
        `https://graph.facebook.com/v21.0/${biz.id}/whatsapp_business_accounts?fields=id,name&access_token=${longToken}`
      )
      const wabaListJson = await wabaListRes.json()
      const wabas: any[] = wabaListJson.data ?? []
      if (wabas.length > 0) {
        finalWabaId = wabas[0].id
        console.log(`[meta/connect] WABA descoberta: ${wabas[0].name}(${finalWabaId}) via business ${biz.name}`)
        break
      }
    }

    if (!finalWabaId) {
      console.error('[meta/connect] nenhuma WABA encontrada para este token')
      return NextResponse.json({ error: 'Nenhuma conta WhatsApp Business encontrada neste perfil. Verifique se sua conta Facebook tem um Business Manager com WhatsApp Business configurado.' }, { status: 404 })
    }
  }

  // Busca número de telefone
  let finalPhoneNumberId = phoneNumberId
  let phone: string = phoneNumberId ?? finalWabaId

  if (coex || !phoneNumberId) {
    const numbersRes = await fetch(
      `https://graph.facebook.com/v21.0/${finalWabaId}/phone_numbers?fields=id,display_phone_number,verified_name&access_token=${longToken}`
    )
    const numbersJson = await numbersRes.json()
    const numbers: any[] = numbersJson.data ?? []
    console.log(`[meta/connect] WABA ${finalWabaId} — números:`, numbers.map((n: any) => n.display_phone_number))
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

  // Inscreve o número no webhook do app
  if (finalPhoneNumberId) {
    const webhookRes = await fetch(
      `https://graph.facebook.com/v21.0/${finalPhoneNumberId}/subscribed_apps`,
      { method: 'POST', headers: { Authorization: `Bearer ${longToken}` } }
    )
    if (!webhookRes.ok) {
      console.warn('[meta/connect] webhook subscribe warn:', await webhookRes.text())
    }
  }

  // Salva na sdr_configs
  const supabase = createServiceClient()
  const { error: dbErr } = await supabase
    .from('sdr_configs')
    .update({
      whatsapp_provider: 'meta',
      meta_wa_phone_number_id: finalPhoneNumberId,
      meta_wa_waba_id: finalWabaId,
      meta_wa_token: longToken,
    })
    .eq('company_id', context.companyId)

  if (dbErr) {
    console.error('[meta/connect] db error:', dbErr)
    return NextResponse.json({ error: 'Erro ao salvar configuração' }, { status: 500 })
  }

  console.log(`[meta/connect] empresa ${context.companyId} conectada — wabaId=${finalWabaId} phone=${phone}`)
  return NextResponse.json({ ok: true, phone, token: longToken, phoneNumberId: finalPhoneNumberId, wabaId: finalWabaId })
  } catch (e: any) {
    console.error('[meta/connect] unhandled error:', e)
    return NextResponse.json({ error: e?.message ?? 'Erro interno' }, { status: 500 })
  }
}

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
