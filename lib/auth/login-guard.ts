import { createHash } from 'crypto'
import { createServiceClient } from '@/lib/supabase/server'

// Trava de tentativas sobre a tabela auth_login_attempts. Cada regra tem uma chave
// (guardada só como hash), um limite dentro de uma janela e um tempo de trava contado
// da última tentativa. Passado o tempo, cada nova tentativa trava de novo.
export type Rule = { kind: string; max: number; windowMs: number; lockMs: number }

const MIN = 60 * 1000

export const RULES = {
  loginEmail: { kind: 'login', max: 5, windowMs: 15 * MIN, lockMs: 5 * MIN },
  loginIp: { kind: 'login-ip', max: 20, windowMs: 15 * MIN, lockMs: 15 * MIN },
  mfaUser: { kind: 'mfa', max: 5, windowMs: 15 * MIN, lockMs: 5 * MIN },
  forgotEmail: { kind: 'forgot', max: 3, windowMs: 15 * MIN, lockMs: 15 * MIN },
  forgotIp: { kind: 'forgot-ip', max: 10, windowMs: 15 * MIN, lockMs: 15 * MIN },
  signupEmail: { kind: 'signup', max: 3, windowMs: 60 * MIN, lockMs: 60 * MIN },
  signupIp: { kind: 'signup-ip', max: 5, windowMs: 60 * MIN, lockMs: 60 * MIN },
} as const satisfies Record<string, Rule>

export const LOGIN_MAX_ATTEMPTS = RULES.loginEmail.max

function keyHash(rule: Rule, value: string): string {
  return createHash('sha256').update(`${rule.kind}:${value.trim().toLowerCase()}`).digest('hex')
}

export function clientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  )
}

type Check = { rule: Rule; value: string }

async function lockedFor({ rule, value }: Check): Promise<number> {
  if (!value || value === 'unknown') return 0
  const since = new Date(Date.now() - rule.windowMs).toISOString()
  const { data, error } = await createServiceClient()
    .from('auth_login_attempts')
    .select('created_at')
    .eq('email_hash', keyHash(rule, value))
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(rule.max)
  if (error) throw error
  if (!data || data.length < rule.max) return 0
  const until = new Date(data[0].created_at).getTime() + rule.lockMs
  return Math.max(0, Math.ceil((until - Date.now()) / 1000))
}

/** Segundos até poder tentar de novo (0 = livre). Se o banco falhar, libera: não trancar cliente por erro nosso. */
export async function lockSeconds(checks: Check[]): Promise<number> {
  try {
    const all = await Promise.all(checks.map(lockedFor))
    return Math.max(0, ...all)
  } catch (err) {
    console.error('[login-guard] lockSeconds falhou, liberando:', err)
    return 0
  }
}

/** Grava uma tentativa para cada chave e devolve quantas ainda restam na PRIMEIRA chave antes da trava. */
export async function recordHits(checks: Check[], ip?: string): Promise<number> {
  const first = checks[0]
  try {
    const supabase = createServiceClient()
    const rows = checks
      .filter((c) => c.value && c.value !== 'unknown')
      .map((c) => ({ email_hash: keyHash(c.rule, c.value), ip: ip ?? null }))
    if (rows.length) await supabase.from('auth_login_attempts').insert(rows)

    const since = new Date(Date.now() - first.rule.windowMs).toISOString()
    const { count } = await supabase
      .from('auth_login_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('email_hash', keyHash(first.rule, first.value))
      .gte('created_at', since)

    // limpeza ocasional de registros com mais de 1 dia
    if (Math.random() < 0.02) {
      await supabase
        .from('auth_login_attempts')
        .delete()
        .lt('created_at', new Date(Date.now() - 24 * 60 * MIN).toISOString())
    }
    return Math.max(0, first.rule.max - (count ?? 0))
  } catch (err) {
    console.error('[login-guard] recordHits falhou:', err)
    return first.rule.max
  }
}

export async function clearHits(check: Check): Promise<void> {
  try {
    await createServiceClient().from('auth_login_attempts').delete().eq('email_hash', keyHash(check.rule, check.value))
  } catch (err) {
    console.error('[login-guard] clearHits falhou:', err)
  }
}
