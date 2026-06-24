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
