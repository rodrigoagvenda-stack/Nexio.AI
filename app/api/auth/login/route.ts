import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { RULES, clearHits, clientIp, lockSeconds, recordHits } from '@/lib/auth/login-guard'

// POST /api/auth/login : login por e-mail e senha com trava de tentativas.
// A mensagem de erro é sempre a mesma (não revela se o e-mail existe) e a contagem
// vale para qualquer e-mail digitado, exista ou não.
export async function POST(request: NextRequest) {
  let body: { email?: unknown; password?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  if (!email || !password || email.length > 254 || password.length > 512) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }

  const ip = clientIp(request)
  const checks = [
    { rule: RULES.loginEmail, value: email },
    { rule: RULES.loginIp, value: ip },
  ]

  const retryAfterSec = await lockSeconds(checks)
  if (retryAfterSec > 0) {
    return NextResponse.json(
      { error: 'too_many_attempts', retryAfterSec },
      { status: 429, headers: { 'Retry-After': String(retryAfterSec) } },
    )
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error || !data.user) {
    const remaining = await recordHits(checks, ip)
    if (remaining === 0) {
      const lock = await lockSeconds(checks)
      if (lock > 0) {
        return NextResponse.json(
          { error: 'too_many_attempts', retryAfterSec: lock },
          { status: 429, headers: { 'Retry-After': String(lock) } },
        )
      }
    }
    return NextResponse.json({ error: 'invalid_credentials', remaining }, { status: 401 })
  }

  await clearHits(checks[0])

  // último acesso (a coluna nunca era gravada)
  createServiceClient()
    .from('users')
    .update({ last_login: new Date().toISOString() })
    .eq('auth_user_id', data.user.id)
    .then(undefined, () => {})

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  const needsMfa = aal?.nextLevel === 'aal2' && aal?.currentLevel !== 'aal2'

  return NextResponse.json({ ok: true, next: needsMfa ? '/mfa' : '/dashboard' })
}
