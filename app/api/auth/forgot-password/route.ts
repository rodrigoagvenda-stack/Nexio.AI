import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { RULES, clientIp, lockSeconds, recordHits } from '@/lib/auth/login-guard'

// POST /api/auth/forgot-password : pede o link de redefinição com limite por e-mail e por IP.
// Sempre responde ok (não revela se o e-mail existe); só devolve 429 quando o limite estoura.
export async function POST(request: NextRequest) {
  let body: { email?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!email || email.length > 254) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }

  const ip = clientIp(request)
  const checks = [
    { rule: RULES.forgotEmail, value: email },
    { rule: RULES.forgotIp, value: ip },
  ]

  const retryAfterSec = await lockSeconds(checks)
  if (retryAfterSec > 0) {
    return NextResponse.json(
      { error: 'too_many_attempts', retryAfterSec },
      { status: 429, headers: { 'Retry-After': String(retryAfterSec) } },
    )
  }

  await recordHits(checks, ip)

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.headers.get('origin') || 'https://app.zaapply.com.br'
  try {
    const supabase = await createClient()
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${appUrl}/api/auth/callback?next=/reset-password`,
    })
  } catch (err) {
    console.error('[forgot-password] falhou:', err)
  }

  return NextResponse.json({ ok: true })
}
