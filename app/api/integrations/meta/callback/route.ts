import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { createServiceClient } from '@/lib/supabase/server'

const APP_ID     = process.env.META_APP_ID!
const APP_SECRET = process.env.META_APP_SECRET!
const REDIRECT   = process.env.NEXT_PUBLIC_APP_URL
  ? `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/meta/callback`
  : 'https://app.zaapply.com.br/api/integrations/meta/callback'

const SETTINGS = '/configuracoes?tab=integracoes'

function signState(payload: string): string {
  return createHmac('sha256', APP_SECRET).update(payload).digest('hex')
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const code  = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(`${SETTINGS}&meta_error=${encodeURIComponent(error)}`, { status: 302 })
  }
  if (!code || !state) {
    return NextResponse.redirect(`${SETTINGS}&meta_error=missing_params`, { status: 302 })
  }

  // Valida state
  const parts = state.split('.')
  if (parts.length !== 2) return NextResponse.redirect(`${SETTINGS}&meta_error=invalid_state`, { status: 302 })

  const [payload, sig] = parts
  if (signState(payload) !== sig) {
    return NextResponse.redirect(`${SETTINGS}&meta_error=invalid_state`, { status: 302 })
  }

  let parsed: { cid: number; ts: number }
  try { parsed = JSON.parse(Buffer.from(payload, 'base64url').toString()) }
  catch { return NextResponse.redirect(`${SETTINGS}&meta_error=bad_state`, { status: 302 }) }

  // State expira em 15 minutos
  if (Date.now() - parsed.ts > 15 * 60 * 1000) {
    return NextResponse.redirect(`${SETTINGS}&meta_error=state_expired`, { status: 302 })
  }

  // Troca code por short-lived token
  const tokenRes = await fetch(
    `https://graph.facebook.com/v25.0/oauth/access_token?` +
    new URLSearchParams({ client_id: APP_ID, redirect_uri: REDIRECT, client_secret: APP_SECRET, code }),
  )
  const tokenData = await tokenRes.json()
  if (!tokenData.access_token) {
    return NextResponse.redirect(`${SETTINGS}&meta_error=token_exchange`, { status: 302 })
  }

  // Troca por long-lived token (60 dias)
  const llRes = await fetch(
    `https://graph.facebook.com/v25.0/oauth/access_token?` +
    new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: APP_ID,
      client_secret: APP_SECRET,
      fb_exchange_token: tokenData.access_token,
    }),
  )
  const llData = await llRes.json()
  const accessToken = llData.access_token ?? tokenData.access_token

  // Salva token em sdr_configs (sem account ainda — usuário seleciona depois)
  const supabase = createServiceClient()
  const { error: dbErr } = await supabase
    .from('sdr_configs')
    .upsert(
      { company_id: parsed.cid, meta_access_token: accessToken, meta_ad_account_id: null, meta_ad_account_name: null },
      { onConflict: 'company_id', ignoreDuplicates: false },
    )

  if (dbErr) {
    return NextResponse.redirect(`${SETTINGS}&meta_error=db`, { status: 302 })
  }

  return NextResponse.redirect(`${SETTINGS}&meta=connected`, { status: 302 })
}
