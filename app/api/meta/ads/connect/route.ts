// Peça B do plano "máquina de vendas completa": conexão da Marketing API da
// Meta (conta de anúncios, escopo ads_management). Fluxo em duas etapas,
// diferente do WhatsApp (Embedded Signup escolhe a conta dentro do próprio
// popup da Meta via config_id — não existe equivalente pra conta de
// anúncios): POST troca o code por token, lista as contas reais do usuário
// via /me/adaccounts e devolve pro front escolher; PATCH recebe a conta
// escolhida e finaliza o save. O token trafega só entre servidor e Redis —
// nunca é exposto ao navegador entre as duas etapas.
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { createServiceClient } from '@/lib/supabase/server'
import { encrypt } from '@/lib/crypto'
import { getRedis } from '@/lib/sdr/redis'

export const runtime = 'nodejs'

function pendingKey(companyId: number) {
  return `meta_ads_pending_token:${companyId}`
}

// POST: troca o code por token, lista as contas de anúncio reais do usuário.
export async function POST(req: NextRequest) {
  try {
    const { context, error: authError } = await requireAuth(req)
    if (authError) return authError

    const { code } = await req.json()
    if (!code) {
      return NextResponse.json({ error: 'code é obrigatório' }, { status: 400 })
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

    const accountsRes = await fetch(
      `https://graph.facebook.com/v21.0/me/adaccounts?fields=id,name,account_status,currency&limit=200&access_token=${longToken}`
    )
    const accountsJson = await accountsRes.json()
    if (!accountsRes.ok) {
      console.error('[meta/ads/connect] erro ao listar contas de anúncio:', accountsJson)
      return NextResponse.json({ error: 'Falha ao listar contas de anúncio', detail: accountsJson?.error?.message }, { status: 400 })
    }

    const accounts = (accountsJson.data ?? []).map((a: any) => ({
      id: String(a.id).replace(/^act_/, ''),
      name: a.name,
      status: a.account_status,
      currency: a.currency,
    }))

    if (!accounts.length) {
      return NextResponse.json({ error: 'Nenhuma conta de anúncio encontrada pra esse login da Meta' }, { status: 404 })
    }

    // Token fica só no Redis, 10min, pra dar tempo do usuário escolher a
    // conta sem precisar logar de novo -- nunca volta pro navegador.
    await getRedis().set(pendingKey(context.companyId), longToken, 'EX', 600)

    return NextResponse.json({ accounts })
  } catch (e: any) {
    console.error('[meta/ads/connect] unhandled error:', e)
    return NextResponse.json({ error: e?.message ?? 'Erro interno' }, { status: 500 })
  }
}

// PATCH: usuário escolheu a conta -- finaliza usando o token pendente no Redis.
export async function PATCH(req: NextRequest) {
  try {
    const { context, error: authError } = await requireAuth(req)
    if (authError) return authError

    const { adAccountId } = await req.json()
    if (!adAccountId) {
      return NextResponse.json({ error: 'adAccountId é obrigatório' }, { status: 400 })
    }

    const redis = getRedis()
    const key = pendingKey(context.companyId)
    const longToken = await redis.get(key)
    if (!longToken) {
      return NextResponse.json({ error: 'Sessão de conexão expirou, tente conectar de novo' }, { status: 410 })
    }

    const normalizedId = String(adAccountId).replace(/^act_/, '')
    const accountRes = await fetch(
      `https://graph.facebook.com/v21.0/act_${normalizedId}?fields=name&access_token=${longToken}`
    )
    const accountJson = await accountRes.json()
    if (!accountRes.ok) {
      console.error('[meta/ads/connect] erro ao validar conta escolhida:', accountJson)
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

    await redis.del(key)

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
