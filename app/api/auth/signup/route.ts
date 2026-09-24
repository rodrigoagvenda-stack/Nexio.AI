import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { RULES, clientIp, lockSeconds, recordHits } from '@/lib/auth/login-guard'

// POST /api/auth/signup : cria a conta com limite por e-mail e por IP (a trava do cadastro
// antes vivia só na memória da página e zerava ao recarregar).
export async function POST(request: NextRequest) {
  let body: { name?: unknown; email?: unknown; password?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body.password === 'string' ? body.password : ''

  if (!name || name.length > 120 || !email || email.length > 254) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }
  if (password.length < 8 || password.length > 512) {
    return NextResponse.json({ error: 'weak_password' }, { status: 400 })
  }

  const ip = clientIp(request)
  const checks = [
    { rule: RULES.signupEmail, value: email },
    { rule: RULES.signupIp, value: ip },
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
  const supabase = await createClient()
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: name },
      emailRedirectTo: `${appUrl}/api/auth/callback`,
    },
  })

  if (error) {
    // Mensagem genérica : evita enumerar se o e-mail já existe
    console.error('[signup] falhou:', error.message)
    return NextResponse.json({ error: 'signup_failed' }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
