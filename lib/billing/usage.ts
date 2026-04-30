/**
 * Billing — token tracking e controle de franquia
 *
 * Fluxo por requisição do SDR:
 *   1. checkTenantQuota      → allowed | via extra_package | blocked
 *   2. (engine processa)
 *   3. recordUsage           → salva em usage_logs, debita pacote extra se necessário
 *   4. checkAndSendQuotaAlerts → email 80% / 95% (fire-and-forget)
 *
 * getMonthlyInvoice → retorna objeto de fatura para a API
 */

import { createServiceClient } from '@/lib/supabase/server'
import { sendTokenAlertEmail } from '@/lib/email/resend'

// ─── Tipos ──────────────────────────────────────────────────────────────────

export interface UsageEntry {
  agent: string
  model: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

export type UsageAcc = UsageEntry[]

export interface QuotaCheck {
  allowed: boolean
  via: 'quota' | 'extra_package' | 'blocked'
  packageId?: string
  usedThisMonth?: number
  quota?: number
}

export interface MonthlyInvoice {
  mensalidade: number
  tokens_usados: number
  franquia: number
  excedente_tokens: number
  custo_excedente: number
  total: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function monthStart(): string {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
}

type Supabase = ReturnType<typeof createServiceClient>

async function getPlanQuota(tenantId: number, supabase: Supabase): Promise<number> {
  const { data: company } = await supabase
    .from('companies')
    .select('plan_type')
    .eq('id', tenantId)
    .single()

  const { data: plan } = await supabase
    .from('plans')
    .select('token_quota')
    .eq('name', company?.plan_type ?? 'starter')
    .single()

  // Fallback: se plano não encontrado, usa 500k (starter)
  return plan?.token_quota ?? 500_000
}

async function getMonthUsage(tenantId: number, supabase: Supabase): Promise<number> {
  const { data } = await supabase
    .from('usage_logs')
    .select('total_tokens')
    .eq('tenant_id', tenantId)
    .gte('created_at', monthStart())

  return (data ?? []).reduce((s, r) => s + (r.total_tokens ?? 0), 0)
}

// ─── checkTenantQuota ────────────────────────────────────────────────────────

export async function checkTenantQuota(
  tenantId: number,
  supabase: Supabase
): Promise<QuotaCheck> {
  const quota = await getPlanQuota(tenantId, supabase)
  const usedThisMonth = await getMonthUsage(tenantId, supabase)

  if (usedThisMonth < quota) {
    return { allowed: true, via: 'quota', usedThisMonth, quota }
  }

  // Franquia esgotada → verifica pacotes extras com saldo
  const { data: packages } = await supabase
    .from('extra_packages')
    .select('id, tokens_granted, tokens_used, valid_until')
    .eq('tenant_id', tenantId)
    .gt('valid_until', new Date().toISOString())
    .order('valid_until', { ascending: true })

  for (const pkg of packages ?? []) {
    if ((pkg.tokens_granted - pkg.tokens_used) > 0) {
      return { allowed: true, via: 'extra_package', packageId: pkg.id, usedThisMonth, quota }
    }
  }

  return { allowed: false, via: 'blocked', usedThisMonth, quota }
}

// ─── debitExtraPackage ───────────────────────────────────────────────────────

export async function debitExtraPackage(
  packageId: string,
  tokens: number,
  supabase: Supabase
): Promise<void> {
  const { data: pkg } = await supabase
    .from('extra_packages')
    .select('tokens_used')
    .eq('id', packageId)
    .single()

  if (pkg != null) {
    await supabase
      .from('extra_packages')
      .update({ tokens_used: pkg.tokens_used + tokens })
      .eq('id', packageId)
  }
}

// ─── recordUsage ─────────────────────────────────────────────────────────────

export async function recordUsage(
  tenantId: number,
  entries: UsageAcc,
  supabase: Supabase,
  packageId?: string
): Promise<void> {
  if (entries.length === 0) return

  let remainingPackageTokens = packageId
    ? await (async () => {
        const { data } = await supabase
          .from('extra_packages')
          .select('tokens_granted, tokens_used')
          .eq('id', packageId)
          .single()
        return data ? data.tokens_granted - data.tokens_used : 0
      })()
    : 0

  for (const entry of entries) {
    // Preço ativo mais recente para este modelo
    const { data: price } = await supabase
      .from('model_prices')
      .select('id, input_price, output_price')
      .eq('model', entry.model)
      .eq('active', true)
      .order('valid_from', { ascending: false })
      .limit(1)
      .maybeSingle()

    const inputPrice = Number(price?.input_price ?? 0)
    const outputPrice = Number(price?.output_price ?? 0)
    const costUsd =
      (entry.promptTokens * inputPrice + entry.completionTokens * outputPrice) / 1_000_000

    await supabase.from('usage_logs').insert({
      tenant_id: tenantId,
      agent: entry.agent,
      model: entry.model,
      prompt_tokens: entry.promptTokens,
      completion_tokens: entry.completionTokens,
      total_tokens: entry.totalTokens,
      cost_usd: costUsd,
      model_price_id: price?.id ?? null,
    })

    // Debitar pacote extra (até esgotar o saldo disponível)
    if (packageId && remainingPackageTokens > 0 && entry.totalTokens > 0) {
      const toDebit = Math.min(entry.totalTokens, remainingPackageTokens)
      await debitExtraPackage(packageId, toDebit, supabase).catch(() => {})
      remainingPackageTokens -= toDebit
    }
  }
}

// ─── pauseTenant ─────────────────────────────────────────────────────────────

export async function pauseTenant(tenantId: number, supabase: Supabase): Promise<void> {
  await supabase.from('companies').update({ agente_ativo: false }).eq('id', tenantId)
}

// ─── checkAndSendQuotaAlerts (fire-and-forget) ───────────────────────────────

export async function checkAndSendQuotaAlerts(
  tenantId: number,
  supabase: Supabase
): Promise<void> {
  try {
    const { data: company } = await supabase
      .from('companies')
      .select('email, name, plan_type, token_alert_80_sent_at, token_alert_95_sent_at')
      .eq('id', tenantId)
      .single()

    if (!company?.email) return

    const quota = await getPlanQuota(tenantId, supabase)
    const used = await getMonthUsage(tenantId, supabase)
    const pct = quota > 0 ? used / quota : 0
    const month = monthStart()

    if (pct >= 0.95 && (!company.token_alert_95_sent_at || company.token_alert_95_sent_at < month)) {
      await sendTokenAlertEmail({
        to: company.email,
        companyName: company.name,
        percent: 95,
        usedTokens: used,
        quota,
      }).catch(() => {})
      await supabase
        .from('companies')
        .update({ token_alert_95_sent_at: new Date().toISOString() })
        .eq('id', tenantId)
    } else if (pct >= 0.80 && (!company.token_alert_80_sent_at || company.token_alert_80_sent_at < month)) {
      await sendTokenAlertEmail({
        to: company.email,
        companyName: company.name,
        percent: 80,
        usedTokens: used,
        quota,
      }).catch(() => {})
      await supabase
        .from('companies')
        .update({ token_alert_80_sent_at: new Date().toISOString() })
        .eq('id', tenantId)
    }
  } catch {
    // alertas nunca bloqueiam o fluxo
  }
}

// ─── getMonthlyInvoice ───────────────────────────────────────────────────────

export async function getMonthlyInvoice(tenantId: number): Promise<MonthlyInvoice> {
  const supabase = createServiceClient()

  const { data: company } = await supabase
    .from('companies')
    .select('plan_type')
    .eq('id', tenantId)
    .single()

  const { data: plan } = await supabase
    .from('plans')
    .select('monthly_price, token_quota, overage_markup')
    .eq('name', company?.plan_type ?? 'starter')
    .single()

  const mensalidade = Number(plan?.monthly_price ?? 0)
  const quota = Number(plan?.token_quota ?? 500_000)
  const markup = Number(plan?.overage_markup ?? 1.5)

  const { data: logs } = await supabase
    .from('usage_logs')
    .select('total_tokens, cost_usd')
    .eq('tenant_id', tenantId)
    .gte('created_at', monthStart())

  const tokensUsados = (logs ?? []).reduce((s, r) => s + (r.total_tokens ?? 0), 0)
  const totalCostUsd = (logs ?? []).reduce((s, r) => s + Number(r.cost_usd ?? 0), 0)

  const excedenteTokens = Math.max(0, tokensUsados - quota)
  const overageRatio = tokensUsados > 0 ? excedenteTokens / tokensUsados : 0
  const custoExcedenteUsd = totalCostUsd * overageRatio * markup
  const usdToBrl = parseFloat(process.env.USD_TO_BRL ?? '5.5')
  const custoExcedente = parseFloat((custoExcedenteUsd * usdToBrl).toFixed(2))

  return {
    mensalidade,
    tokens_usados: tokensUsados,
    franquia: quota,
    excedente_tokens: excedenteTokens,
    custo_excedente: custoExcedente,
    total: parseFloat((mensalidade + custoExcedente).toFixed(2)),
  }
}
