import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { createServiceClient } from '@/lib/supabase/server'
import { listPayments } from '@/lib/asaas/company-client'

// Asaas status → status normalizado
const ASAAS_STATUS_MAP: Record<string, string> = {
  RECEIVED: 'paid', CONFIRMED: 'paid', RECEIVED_IN_CASH: 'paid', DUNNING_RECEIVED: 'paid',
  PENDING: 'pending', AWAITING_RISK_ANALYSIS: 'pending', APPROVED_BY_RISK_ANALYSIS: 'pending',
  PAYMENT_APPROVED: 'pending', IN_ANALYSIS: 'pending',
  OVERDUE: 'overdue', DUNNING_REQUESTED: 'overdue',
  REFUNDED: 'cancelled', REFUND_REQUESTED: 'cancelled', CHARGEBACK_REQUESTED: 'cancelled',
  CHARGEBACK_DISPUTE: 'cancelled', AWAITING_CHARGEBACK_REVERSAL: 'cancelled', CANCELLED: 'cancelled',
}

// Mercado Pago status → status normalizado
const MP_STATUS_MAP: Record<string, string> = {
  approved: 'paid', authorized: 'paid',
  pending: 'pending', in_process: 'pending', in_mediation: 'pending',
  rejected: 'cancelled', cancelled: 'cancelled', refunded: 'cancelled', charged_back: 'cancelled',
}

async function fetchAsaasCharges(companyId: number, cfg: any, dateGte?: string, statusFilter?: string) {
  try {
    const result = await listPayments(companyId, {
      status: statusFilter !== 'all' ? statusFilter : undefined,
      dateCreatedGte: dateGte,
      limit: 200,
    })
    return (result.data ?? []).map((p: any) => ({
      id: `asaas_${p.id}`,
      platform: 'asaas' as const,
      external_id: p.id,
      amount: p.value,
      description: p.description ?? null,
      billing_type: p.billingType ?? null,
      due_date: p.dueDate ?? null,
      status: ASAAS_STATUS_MAP[p.status] ?? 'pending',
      payment_url: p.invoiceUrl ?? null,
      invoice_url: p.bankSlipUrl ?? p.invoiceUrl ?? null,
      created_at: p.dateCreated,
      lead_name: p.customerName ?? null,
    }))
  } catch {
    return []
  }
}

async function fetchMercadoPagoCharges(cfg: any, dateGte?: string, statusFilter?: string) {
  try {
    const token = cfg?.access_token
    if (!token) return []
    const qs = new URLSearchParams({ sort: 'date_created', criteria: 'desc', limit: '200' })
    if (dateGte) {
      qs.set('range', 'date_created')
      qs.set('begin_date', `${dateGte}T00:00:00.000-03:00`)
    }
    if (statusFilter && statusFilter !== 'all') qs.set('status', statusFilter)
    const res = await fetch(`https://api.mercadopago.com/v1/payments/search?${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    if (!res.ok) return []
    const json = await res.json()
    return (json.results ?? []).map((p: any) => ({
      id: `mp_${p.id}`,
      platform: 'mercadopago' as const,
      external_id: String(p.id),
      amount: p.transaction_amount ?? 0,
      description: p.description ?? null,
      billing_type: p.payment_type_id ?? null,
      due_date: p.date_of_expiration ? p.date_of_expiration.split('T')[0] : null,
      status: MP_STATUS_MAP[p.status] ?? 'pending',
      payment_url: p.init_point ?? null,
      invoice_url: null,
      created_at: p.date_created,
      lead_name: p.payer?.email ?? p.payer?.identification?.number ?? null,
    }))
  } catch {
    return []
  }
}

async function fetchKiwifyCharges(companyId: number, supabase: any, dateGte?: string, statusFilter?: string) {
  // Kiwify não tem API de listagem pública — usa lead_charges populado pelos webhooks
  let query = supabase
    .from('lead_charges')
    .select('id, platform, external_id, amount, description, billing_type, due_date, status, payment_url, invoice_url, created_at, leads(contact_name, company_name)')
    .eq('company_id', companyId)
    .eq('platform', 'kiwify')
    .order('created_at', { ascending: false })
    .limit(200)
  if (statusFilter && statusFilter !== 'all') query = query.eq('status', statusFilter)
  if (dateGte) query = query.gte('created_at', `${dateGte}T00:00:00`)
  const { data } = await query
  return (data ?? []).map((c: any) => ({
    id: `kiwify_${c.id}`,
    platform: 'kiwify' as const,
    external_id: c.external_id,
    amount: c.amount ?? 0,
    description: c.description ?? null,
    billing_type: c.billing_type ?? null,
    due_date: c.due_date ?? null,
    status: c.status ?? 'pending',
    payment_url: c.payment_url ?? null,
    invoice_url: c.invoice_url ?? null,
    created_at: c.created_at,
    lead_name: c.leads?.contact_name || c.leads?.company_name || null,
  }))
}

export async function GET(req: NextRequest) {
  const { context, error: authError } = await requireAuth(req)
  if (authError) return authError

  const { searchParams } = new URL(req.url)
  const statusFilter = searchParams.get('status') ?? 'all'
  const period = searchParams.get('period') ?? '30'
  const platformFilter = searchParams.get('platform') ?? 'all'

  const supabase = createServiceClient()

  // Busca integrações ativas da empresa
  const { data: integrations } = await supabase
    .from('payment_integrations')
    .select('platform, config, active')
    .eq('company_id', context.companyId)
    .eq('active', true)

  if (!integrations?.length) {
    return NextResponse.json({ charges: [], stats: { received: 0, pending: 0, overdue: 0, total: 0 } })
  }

  let dateGte: string | undefined
  if (period !== 'all') {
    const days = parseInt(period)
    if (!isNaN(days)) {
      const from = new Date()
      from.setDate(from.getDate() - days)
      dateGte = from.toISOString().split('T')[0]
    }
  }

  // Busca em paralelo apenas nas plataformas ativas (e filtradas)
  const fetches: Promise<any[]>[] = []
  for (const integration of integrations) {
    if (platformFilter !== 'all' && integration.platform !== platformFilter) continue
    if (integration.platform === 'asaas') {
      fetches.push(fetchAsaasCharges(context.companyId, integration.config, dateGte, statusFilter))
    } else if (integration.platform === 'mercadopago') {
      fetches.push(fetchMercadoPagoCharges(integration.config, dateGte, statusFilter))
    } else if (integration.platform === 'kiwify') {
      fetches.push(fetchKiwifyCharges(context.companyId, supabase, dateGte, statusFilter))
    }
  }

  const results = await Promise.all(fetches)
  const all = results.flat().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  const filtered = statusFilter === 'all' ? all : all.filter(c => c.status === statusFilter)

  const received = filtered.filter(c => c.status === 'paid').reduce((s: number, c: any) => s + c.amount, 0)
  const pending = filtered.filter(c => c.status === 'pending').reduce((s: number, c: any) => s + c.amount, 0)
  const overdue = filtered.filter(c => c.status === 'overdue').reduce((s: number, c: any) => s + c.amount, 0)

  return NextResponse.json({
    charges: filtered,
    stats: { received, pending, overdue, total: filtered.length },
  })
}
