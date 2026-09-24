import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { RULES, clearHits, lockSeconds, recordHits } from '@/lib/auth/login-guard'

// POST /api/auth/mfa : confere o código de 6 dígitos com trava por usuário
// (5 erros em 15 min travam por 5 min). Exige a sessão já aberta pela senha.
export async function POST(request: NextRequest) {
  let body: { code?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }

  const code = typeof body.code === 'string' ? body.code.trim() : ''
  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const check = { rule: RULES.mfaUser, value: user.id }

  const retryAfterSec = await lockSeconds([check])
  if (retryAfterSec > 0) {
    return NextResponse.json(
      { error: 'too_many_attempts', retryAfterSec },
      { status: 429, headers: { 'Retry-After': String(retryAfterSec) } },
    )
  }

  const { data: factors } = await supabase.auth.mfa.listFactors()
  const factorId = factors?.totp?.[0]?.id
  if (!factorId) {
    return NextResponse.json({ ok: true, next: '/dashboard' })
  }

  const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId })
  if (challengeErr || !challenge) {
    return NextResponse.json({ error: 'challenge_failed' }, { status: 400 })
  }

  const { error: verifyErr } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code })
  if (verifyErr) {
    const remaining = await recordHits([check])
    if (remaining === 0) {
      const lock = await lockSeconds([check])
      if (lock > 0) {
        return NextResponse.json(
          { error: 'too_many_attempts', retryAfterSec: lock },
          { status: 429, headers: { 'Retry-After': String(lock) } },
        )
      }
    }
    return NextResponse.json({ error: 'invalid_code', remaining }, { status: 401 })
  }

  await clearHits(check)
  return NextResponse.json({ ok: true, next: '/dashboard' })
}
