// Peça B do plano "máquina de vendas completa": conexão da Marketing API da
// Meta (conta de anúncios, escopo ads_read) — separado do WhatsApp Cloud API
// (escopo diferente, token diferente). Espelha exatamente o formato de
// app/api/meta/whatsapp/connect/route.ts. Reaproveita as colunas
// meta_access_token/meta_ad_account_id/meta_ad_account_name em sdr_configs,
// que já existiam desde 20260618100000_meta_oauth.sql mas nunca tinham
// código nenhum lendo/escrevendo nelas.
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { createServiceClient } from '@/lib/supabase/server'
import { encrypt } from '@/lib/crypto'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const { context, error: authError } = await requireAuth(req)
    if (authError) return authError

    const { code, adAccountId } = await req.json()
    if (!code || !adAccountId) {
      return NextResponse.json({ error: 'code e adAccountId são obrigatórios' }, { status: 400 })
    }

    const appId = process.env.NEXT_PUBLIC_META_APP_ID
    const appSecret = process.env.META_APP_SECRET
    if (!appId || !appSecret) {
      return NextResponse.json({ error: 'META_APP_ID ou META_APP_SECRET não configurado' }, { status: 500 })
    }

    const tokenRes = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&code=${code}`
    )
    const tokenJson = await tokenRes.json()
    if (!tokenRes.ok || !tokenJson.access_token) {
      console.error('[meta/ads/connect] token exchange error:', tokenJson)
      return NextResponse.json({ error: 'Falha ao trocar code por token Meta', detail: tokenJson?.error?.message }, { status: 400 })
    }
    const longToken: string = tokenJson.access_token

    const normalizedId = String(adAccountId).replace(/^act_/, '')
    const accountRes = await fetch(
      `https://graph.facebook.com/v21.0/act_${normalizedId}?fields=name&access_token=${longToken}`
    )
    const accountJson = await accountRes.json()
    if (!accountRes.ok) {
      console.error('[meta/ads/connect] erro ao buscar conta de anúncio:', accountJson)
      return NextResponse.json({ error: 'Falha ao validar conta de anúncio', detail: accountJson?.error?.message }, { status: 400 })
    }

    const supabase = createServiceClient()
    const { error: dbErr } = await supabase
      .from('sdr_configs')
      .update({
        meta_access_token: encrypt(longToken),
        meta_ad_account_id: normalizedId,
        meta_ad_account_name: accountJson.name ?? null,
      })
      .eq('company_id', context.companyId)

    if (dbErr) {
      console.error('[meta/ads/connect] db error:', dbErr)
      return NextResponse.json({ error: 'Erro ao salvar configuração' }, { status: 500 })
    }

    console.log(`[meta/ads/connect] empresa ${context.companyId} conectada : adAccountId=${normalizedId} name=${accountJson.name}`)
    return NextResponse.json({ ok: true, adAccountId: normalizedId, name: accountJson.name })
  } catch (e: any) {
    console.error('[meta/ads/connect] unhandled error:', e)
    return NextResponse.json({ error: e?.message ?? 'Erro interno' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const { context, error: authError } = await requireAuth(req)
  if (authError) return authError

  const supabase = createServiceClient()
  const { error: dbErr } = await supabase
    .from('sdr_configs')
    .update({ meta_access_token: null, meta_ad_account_id: null, meta_ad_account_name: null })
    .eq('company_id', context.companyId)

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
