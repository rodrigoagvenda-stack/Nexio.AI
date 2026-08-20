/**
 * lib/asaas/company-client.ts
 * Asaas API client using the COMPANY's own credentials (from payment_integrations),
 * not the platform's API key. Used when a company generates charges for their own leads.
 */

import { createServiceClient } from '@/lib/supabase/server'

interface CompanyAsaasConfig {
  access_token: string
  base_url?: string
}

async function getCompanyAsaasConfig(companyId: number): Promise<CompanyAsaasConfig> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('payment_integrations')
    .select('config')
    .eq('company_id', companyId)
    .eq('platform', 'asaas')
    .eq('active', true)
    .single()

  if (error || !data?.config?.access_token) {
    throw new Error('Integração Asaas não configurada. Acesse Configurações → Integrações → Asaas.')
  }

  return data.config as CompanyAsaasConfig
}

async function companyAsaasRequest<T = any>(
  companyId: number,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: object,
): Promise<T> {
  const cfg = await getCompanyAsaasConfig(companyId)
  const baseUrl = cfg.base_url || 'https://api.asaas.com/v3'

  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'access_token': cfg.access_token,
      'Content-Type': 'application/json',
      'User-Agent': 'zaapply/1.0',
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  })

  const text = await res.text()
  let data: any
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error(`Erro na integração Asaas (${res.status}). Verifique a chave de API nas configurações.`)
  }

  if (!res.ok) {
    const msg = data?.errors?.[0]?.description ?? data?.message ?? `ASAAS error ${res.status}`
    throw new Error(msg)
  }

  return data as T
}

// ─── Customers ────────────────────────────────────────────────────────────────

export interface CompanyAsaasCustomer {
  id: string
  name: string
  email?: string
  mobilePhone?: string
  cpfCnpj?: string
}

export async function findOrCreateCustomer(
  companyId: number,
  params: { name: string; email?: string; phone?: string; cpfCnpj?: string; externalReference?: string }
): Promise<CompanyAsaasCustomer> {
  // Try to find by email first
  if (params.email) {
    const search = await companyAsaasRequest<{ data: CompanyAsaasCustomer[] }>(
      companyId, 'GET', `/customers?email=${encodeURIComponent(params.email)}&limit=1`
    )
    if (search.data?.length) return search.data[0]
  }

  // Try by phone
  if (params.phone) {
    const phone = params.phone.replace(/\D/g, '')
    const search = await companyAsaasRequest<{ data: CompanyAsaasCustomer[] }>(
      companyId, 'GET', `/customers?mobilePhone=${encodeURIComponent(phone)}&limit=1`
    )
    if (search.data?.length) return search.data[0]
  }

  // Create new customer
  return companyAsaasRequest<CompanyAsaasCustomer>(companyId, 'POST', '/customers', {
    name: params.name,
    email: params.email,
    mobilePhone: params.phone?.replace(/\D/g, ''),
    cpfCnpj: params.cpfCnpj?.replace(/\D/g, ''),
    externalReference: params.externalReference,
    notificationDisabled: false,
  })
}

// ─── Charges ──────────────────────────────────────────────────────────────────

export type BillingType = 'BOLETO' | 'PIX' | 'CREDIT_CARD' | 'UNDEFINED'

export interface CompanyAsaasPayment {
  id: string
  status: string
  value: number
  dueDate: string
  billingType: string
  invoiceUrl?: string
  bankSlipUrl?: string
  nossoNumero?: string
  externalReference?: string
}

export interface CompanyAsaasPixQrCode {
  encodedImage: string
  payload: string
  expirationDate: string
}

export async function createCharge(
  companyId: number,
  params: {
    customerId: string
    value: number
    dueDate: string
    billingType: BillingType
    description: string
    externalReference?: string
    installmentCount?: number
    installmentValue?: number
  }
): Promise<CompanyAsaasPayment> {
  return companyAsaasRequest<CompanyAsaasPayment>(companyId, 'POST', '/payments', {
    customer: params.customerId,
    billingType: params.billingType,
    value: params.value,
    dueDate: params.dueDate,
    description: params.description,
    externalReference: params.externalReference,
    ...(params.installmentCount && params.installmentCount > 1
      ? { installmentCount: params.installmentCount, installmentValue: params.installmentValue }
      : {}),
  })
}

export interface CompanyAsaasSubscription {
  id: string
  status: string
  value: number
  nextDueDate: string
  cycle: string
  billingType: string
}

// Assinatura recorrente de verdade (cobra sozinha todo ciclo). Com billingType
// UNDEFINED, o Asaas hospeda a própria página de pagamento e deixa o cliente
// escolher PIX/boleto/cartão -- número de cartão nunca passa pela nossa API,
// vai direto pro Asaas na página deles. Mesmo padrão que /api/asaas/checkout
// já usa pra cobrar a própria assinatura da empresa na Zaapply, só que aqui
// com a chave Asaas da empresa (pra ela cobrar os leads dela).
export async function createSubscription(
  companyId: number,
  params: {
    customerId: string
    value: number
    billingType: BillingType
    description: string
    cycle?: 'WEEKLY' | 'MONTHLY' | 'YEARLY'
    externalReference?: string
  }
): Promise<CompanyAsaasSubscription> {
  const today = new Date().toISOString().slice(0, 10)
  return companyAsaasRequest<CompanyAsaasSubscription>(companyId, 'POST', '/subscriptions', {
    customer: params.customerId,
    billingType: params.billingType,
    value: params.value,
    nextDueDate: today,
    cycle: params.cycle ?? 'MONTHLY',
    description: params.description,
    externalReference: params.externalReference,
  })
}

export async function getSubscriptionFirstPaymentUrl(
  companyId: number,
  subscriptionId: string
): Promise<{ invoiceUrl?: string; bankSlipUrl?: string }> {
  const res = await companyAsaasRequest<{ data: CompanyAsaasPayment[] }>(
    companyId, 'GET', `/subscriptions/${subscriptionId}/payments`
  )
  const first = res.data?.[0]
  return { invoiceUrl: first?.invoiceUrl, bankSlipUrl: first?.bankSlipUrl }
}

export async function getPixQrCode(
  companyId: number,
  paymentId: string
): Promise<CompanyAsaasPixQrCode> {
  return companyAsaasRequest<CompanyAsaasPixQrCode>(companyId, 'GET', `/payments/${paymentId}/pixQrCode`)
}

export async function getPaymentLink(
  companyId: number,
  paymentId: string
): Promise<{ invoiceUrl: string; bankSlipUrl?: string }> {
  return companyAsaasRequest(companyId, 'GET', `/payments/${paymentId}`)
}

export interface AsaasPaymentListItem {
  id: string
  customer: string
  customerName?: string
  billingType: string
  status: string
  value: number
  dueDate: string
  description?: string
  invoiceUrl?: string
  bankSlipUrl?: string
  externalReference?: string
  dateCreated: string
}

export async function listPayments(
  companyId: number,
  params?: {
    status?: string
    dateCreatedGte?: string
    dateCreatedLte?: string
    limit?: number
    offset?: number
  }
): Promise<{ data: AsaasPaymentListItem[]; totalCount: number; hasMore: boolean }> {
  const qs = new URLSearchParams()
  if (params?.status && params.status !== 'all') qs.set('status', params.status.toUpperCase())
  if (params?.dateCreatedGte) qs.set('dateCreatedGte', params.dateCreatedGte)
  if (params?.dateCreatedLte) qs.set('dateCreatedLte', params.dateCreatedLte)
  qs.set('limit', String(params?.limit ?? 100))
  qs.set('offset', String(params?.offset ?? 0))
  // inclui campos de cliente para exibir nome no financeiro
  qs.set('includeDeleted', 'false')

  const res = await companyAsaasRequest<{ data: AsaasPaymentListItem[]; totalCount: number; hasMore: boolean }>(
    companyId, 'GET', `/payments?${qs.toString()}`
  )
  return res
}
