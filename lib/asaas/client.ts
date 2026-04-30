/**
 * Asaas API client — mensalidades (cartão) e pacotes extras (PIX)
 *
 * Env vars:
 *   ASAAS_API_KEY      — chave de acesso
 *   ASAAS_BASE_URL     — https://sandbox.asaas.com/api/v3  (ou prod)
 */

const BASE = (process.env.ASAAS_BASE_URL ?? 'https://sandbox.asaas.com/api/v3').replace(/\/$/, '')

function headers() {
  return {
    'Content-Type': 'application/json',
    access_token: process.env.ASAAS_API_KEY ?? '',
  }
}

async function asaasReq<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: headers(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const json = await res.json()
  if (!res.ok) {
    const msg = json?.errors?.[0]?.description ?? json?.error ?? `Asaas error ${res.status}`
    throw new Error(msg)
  }
  return json as T
}

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface AsaasCustomer {
  id: string
  name: string
  email: string
  cpfCnpj?: string
}

export interface AsaasSubscription {
  id: string
  customer: string
  value: number
  nextDueDate: string
  cycle: string
  status: string
}

export interface AsaasPayment {
  id: string
  customer: string
  subscription?: string
  billingType: string
  value: number
  status: string
  dueDate: string
  paymentDate?: string
}

export interface AsaasPixQrCode {
  encodedImage: string   // base64 PNG
  payload: string        // copia-e-cola
  expirationDate: string
}

export interface CreditCard {
  holderName: string
  number: string
  expiryMonth: string
  expiryYear: string
  ccv: string
}

export interface CreditCardHolderInfo {
  name: string
  email: string
  cpfCnpj: string
  postalCode: string
  addressNumber: string
  phone: string
}

// ─── Customers ───────────────────────────────────────────────────────────────

export async function createOrGetCustomer(params: {
  name: string
  email: string
  cpfCnpj: string
}): Promise<AsaasCustomer> {
  // Tenta buscar pelo email primeiro
  const list = await asaasReq<{ data: AsaasCustomer[] }>('GET', `/customers?email=${encodeURIComponent(params.email)}&limit=1`)
  if (list.data?.length) return list.data[0]

  return asaasReq<AsaasCustomer>('POST', '/customers', {
    name: params.name,
    email: params.email,
    cpfCnpj: params.cpfCnpj,
  })
}

// ─── Subscriptions (cartão recorrente) ───────────────────────────────────────

export async function createSubscription(params: {
  customerId: string
  value: number
  description: string
  nextDueDate: string   // YYYY-MM-DD — data da primeira cobrança
  creditCard: CreditCard
  creditCardHolderInfo: CreditCardHolderInfo
  remoteIp: string
}): Promise<AsaasSubscription> {
  return asaasReq<AsaasSubscription>('POST', '/subscriptions', {
    customer: params.customerId,
    billingType: 'CREDIT_CARD',
    value: params.value,
    nextDueDate: params.nextDueDate,
    cycle: 'MONTHLY',
    description: params.description,
    creditCard: params.creditCard,
    creditCardHolderInfo: params.creditCardHolderInfo,
    remoteIp: params.remoteIp,
  })
}

export async function cancelSubscription(subscriptionId: string): Promise<void> {
  await asaasReq('DELETE', `/subscriptions/${subscriptionId}`)
}

// ─── PIX Charge (pacote extra) ────────────────────────────────────────────────

export async function createPixCharge(params: {
  customerId: string
  value: number
  description: string
  dueDate: string   // YYYY-MM-DD
}): Promise<AsaasPayment> {
  return asaasReq<AsaasPayment>('POST', '/payments', {
    customer: params.customerId,
    billingType: 'PIX',
    value: params.value,
    dueDate: params.dueDate,
    description: params.description,
  })
}

export async function getPixQrCode(paymentId: string): Promise<AsaasPixQrCode> {
  return asaasReq<AsaasPixQrCode>('GET', `/payments/${paymentId}/pixQrCode`)
}

export async function getPayment(paymentId: string): Promise<AsaasPayment> {
  return asaasReq<AsaasPayment>('GET', `/payments/${paymentId}`)
}
