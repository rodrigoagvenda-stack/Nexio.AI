/**
 * Sprint 1 : Confiabilidade
 *
 * Primitivos usados por todos os motores de follow-up:
 *   - Exactly-once lock (Redis SET NX EX) : evita disparo duplo em crons paralelos
 *   - Circuit breaker por sequência : pausa automaticamente se erros > 20% em 30 min
 *   - Retry com backoff exponencial : 15 min → 30 min → 1 h → DLQ (3 tentativas)
 *   - Health check uazapi : ignora empresa com WhatsApp desconectado (cache 2 min)
 */

import { getRedis } from './redis'
import { createUazapiClient } from './uazapi'
import type { SupabaseClient } from '@supabase/supabase-js'

// ─── Lock ─────────────────────────────────────────────────────────────────────

export function sendLockKey(companyId: number, leadOrTrialId: number, stepId: string): string {
  return `follow:lock:${companyId}:${leadOrTrialId}:${stepId}`
}

/** Tenta adquirir o lock. Retorna false se já está bloqueado (outro worker processando). */
export async function acquireSendLock(key: string, ttlSec = 300): Promise<boolean> {
  try {
    const redis = getRedis()
    const result = await redis.set(key, '1', 'EX', ttlSec, 'NX')
    return result === 'OK'
  } catch {
    return true // fail open : Redis indisponível não bloqueia o envio
  }
}

export async function releaseSendLock(key: string): Promise<void> {
  try {
    await getRedis().del(key)
  } catch {}
}

// ─── Circuit Breaker ──────────────────────────────────────────────────────────

const CB_WINDOW_SEC = 1800       // 30 min
const CB_MIN_ATTEMPTS = 5        // mínimo de tentativas antes de abrir
const CB_ERROR_THRESHOLD = 0.20  // 20% de erros → abre

export async function recordCircuitFailure(sequenceId: string): Promise<{ shouldOpen: boolean }> {
  try {
    const redis = getRedis()
    const errKey = `follow:cb:${sequenceId}:err`
    const totKey = `follow:cb:${sequenceId}:tot`
    const [errors, total] = await Promise.all([
      redis.incr(errKey).then(async (n) => { if (n === 1) await redis.expire(errKey, CB_WINDOW_SEC); return n }),
      redis.incr(totKey).then(async (n) => { if (n === 1) await redis.expire(totKey, CB_WINDOW_SEC); return n }),
    ])
    if (total >= CB_MIN_ATTEMPTS && errors / total > CB_ERROR_THRESHOLD) {
      await redis.set(`follow:cb:${sequenceId}:open`, '1', 'EX', CB_WINDOW_SEC)
      return { shouldOpen: true }
    }
    return { shouldOpen: false }
  } catch {
    return { shouldOpen: false }
  }
}

export async function recordCircuitSuccess(sequenceId: string): Promise<void> {
  try {
    const redis = getRedis()
    const totKey = `follow:cb:${sequenceId}:tot`
    const n = await redis.incr(totKey)
    if (n === 1) await redis.expire(totKey, CB_WINDOW_SEC)
  } catch {}
}

export async function isCircuitOpen(sequenceId: string): Promise<boolean> {
  try {
    return !!(await getRedis().exists(`follow:cb:${sequenceId}:open`))
  } catch {
    return false // fail open
  }
}

// ─── Retry + DLQ ─────────────────────────────────────────────────────────────

export const MAX_RETRIES = 3

/** Backoff exponencial: 15min → 30min → 1h (cap 4h) */
export function backoffMs(retryCount: number): number {
  return Math.min(15 * 60_000 * Math.pow(2, retryCount), 4 * 60 * 60_000)
}

export async function getFailedCount(
  leadOrTrialId: number,
  stepId: string,
  supabase: SupabaseClient,
  isTrial = false,
): Promise<number> {
  const field = isTrial ? 'trial_id' : 'lead_id'
  const { count } = await supabase
    .from('follow_executions')
    .select('id', { count: 'exact', head: true })
    .eq(field, leadOrTrialId)
    .eq('step_id', stepId)
    .eq('status', 'failed')
  return count ?? 0
}

/** Retorna true se o backoff expirou e a retry pode ser tentada. */
export async function shouldRetryNow(
  leadOrTrialId: number,
  stepId: string,
  supabase: SupabaseClient,
  isTrial = false,
): Promise<boolean> {
  const field = isTrial ? 'trial_id' : 'lead_id'
  const { data } = await supabase
    .from('follow_executions')
    .select('disparado_em')
    .eq(field, leadOrTrialId)
    .eq('step_id', stepId)
    .eq('status', 'failed')
    .order('disparado_em', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data?.disparado_em) return true
  const failedCount = await getFailedCount(leadOrTrialId, stepId, supabase, isTrial)
  const elapsed = Date.now() - new Date(data.disparado_em).getTime()
  return elapsed >= backoffMs(failedCount - 1)
}

// ─── Fatigue score ────────────────────────────────────────────────────────────

const FATIGUE_WINDOW_SEC = 7 * 24 * 3600  // 7-day rolling window
const FATIGUE_THRESHOLD = 10              // max messages per lead per window

/** Returns true if lead is fatigued and should be skipped. */
export async function isFatigued(companyId: number, leadId: number): Promise<boolean> {
  try {
    const count = parseInt(await getRedis().get(`follow:fatigue:${companyId}:${leadId}`) ?? '0')
    return count >= FATIGUE_THRESHOLD
  } catch {
    return false // fail open
  }
}

/** Increment fatigue counter after a successful send. */
export async function recordFatigue(companyId: number, leadId: number): Promise<void> {
  try {
    const redis = getRedis()
    const key = `follow:fatigue:${companyId}:${leadId}`
    const n = await redis.incr(key)
    if (n === 1) await redis.expire(key, FATIGUE_WINDOW_SEC)
  } catch {}
}

// ─── Best send time ───────────────────────────────────────────────────────────

/**
 * Retorna a hora BRT (0-23) em que o lead costuma responder, ou null se sem padrão.
 * Analisa as últimas 10 mensagens inbound e exige ≥35% concentradas em uma hora.
 * Resultado cacheado 4h no Redis para evitar queries repetidas.
 */
export async function getBestSendHour(
  companyId: number,
  leadId: number,
  supabase: SupabaseClient,
): Promise<number | null> {
  const cacheKey = `follow:besttime:${companyId}:${leadId}`
  try {
    const cached = await getRedis().get(cacheKey)
    if (cached !== null) return cached === '' ? null : parseInt(cached)
  } catch {}

  try {
    const { data } = await supabase
      .from('mensagens_do_whatsapp')
      .select('carimbo_de_data_e_hora')
      .eq('id_do_lead', leadId)
      .eq('company_id', companyId)
      .eq('direcao', 'inbound')
      .order('carimbo_de_data_e_hora', { ascending: false })
      .limit(10)

    const noPattern = async () => { try { await getRedis().set(cacheKey, '', 'EX', 4 * 3600) } catch {} }
    if (!data || data.length < 3) { await noPattern(); return null }

    const hourCounts: Record<number, number> = {}
    for (const msg of data) {
      const brtHour = new Date(new Date(msg.carimbo_de_data_e_hora).getTime() - 3 * 3_600_000).getUTCHours()
      hourCounts[brtHour] = (hourCounts[brtHour] ?? 0) + 1
    }
    const sorted = Object.entries(hourCounts).sort(([, a], [, b]) => b - a)
    const [bestHourStr, count] = sorted[0]
    if (count / data.length < 0.35) { await noPattern(); return null }

    const hour = parseInt(bestHourStr)
    try { await getRedis().set(cacheKey, String(hour), 'EX', 4 * 3600) } catch {}
    return hour
  } catch {
    return null
  }
}

// ─── Health check WhatsApp ────────────────────────────────────────────────────

/** Verifica se a instância uazapi está conectada (cache Redis de 2 min). */
export async function isUazapiHealthy(
  companyId: number,
  uazapiUrl: string,
  token: string,
): Promise<boolean> {
  const cacheKey = `follow:health:${companyId}`
  try {
    const cached = await getRedis().get(cacheKey)
    if (cached !== null) return cached === 'ok'
  } catch {}

  try {
    const uazapi = createUazapiClient(uazapiUrl, token)
    const { status } = await uazapi.getStatus()
    const healthy = status === 'connected'
    try { await getRedis().set(cacheKey, healthy ? 'ok' : 'down', 'EX', 120) } catch {}
    return healthy
  } catch {
    return true // fail open em erros de rede
  }
}
