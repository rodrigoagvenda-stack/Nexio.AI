/**
 * lib/asaas/client.ts
 * Wrapper para a API ASAAS v3.
 * Docs: https://docs.asaas.com
 */

function getBaseUrl(): string {
  const env = process.env.ASAAS_ENV ?? 'sandbox'
  return env === 'production'
    ? 'https://api.asaas.com/v3'
    : 'https://sandbox.asaas.com/api/v3'
}

function getApiKey(): string {
  const key = process.env.ASAAS_API_KEY
  if (!key) throw new Error('ASAAS_API_KEY não configurada')
  return key
}

async function asaasRequest<T = any>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: object,
): Promise<T> {
  const res = await fetch(`${getBaseUrl()}${path}`, {
    method,
    headers: {
      'access_token': getApiKey(),
      'Content-Type': 'application/json',
      'User-Agent': 'zaapli/1.0',
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  })

  const data = await res.json()

  if (!res.ok) {
    const msg = data?.errors?.[0]?.description ?? data?.message ?? `ASAAS error ${res.status}`
    throw new Error(msg)
  }

  return data as T
}

// ─── Customers ────────────────────────────────────────────────────────────────

export interface AsaasCustomer {
  id: string
  name: string
  email: string
  cpfCnpj: string
}

export async function createOrGetCustomer(params: {
  name: string
  email: string
  cpfCnpj: string
}): Promise<AsaasCustomer> {
  // Tenta buscar existente pelo CPF/CNPJ
  const search = await asaasRequest<{ data: AsaasCustomer[] }>(
    'GET',
    `/customers?cpfCnpj=${params.cpfCnpj.replace(/\D/g, '')}`
  )

  if (search.data?.length) return search.data[0]

  return asaasRequest<AsaasCustomer>('POST', '/customers', {
    name: params.name,
    email: params.email,
    cpfCnpj: params.cpfCnpj.replace(/\D/g, ''),
    notificationDisabled: false,
  })
}

// ─── Subscriptions (recorrência mensal via cartão) ────────────────────────────

export interface AsaasSubscription {
  id: string
  status: string
  nextDueDate: string
  value: number
}

export async function createSubscription(params: {
  customerId: string
  value: number
  description: string
  nextDueDate: string          // 'YYYY-MM-DD'
  creditCard: {
    holderName: string
    number: string
    expiryMonth: string
    expiryYear: string
    ccv: string
  }
  creditCardHolderInfo: {
    name: string
    email: string
    cpfCnpj: string
    postalCode: string
    addressNumber: string
    phone: string
  }
  remoteIp: string
}): Promise<AsaasSubscription> {
  return asaasRequest<AsaasSubscription>('POST', '/subscriptions', {
    customer: params.customerId,
    billingType: 'CREDIT_CARD',
    cycle: 'MONTHLY',
    value: params.value,
    description: params.description,
    nextDueDate: params.nextDueDate,
    creditCard: params.creditCard,
    creditCardHolderInfo: {
      name: params.creditCardHolderInfo.name,
      email: params.creditCardHolderInfo.email,
      cpfCnpj: params.creditCardHolderInfo.cpfCnpj.replace(/\D/g, ''),
      postalCode: params.creditCardHolderInfo.postalCode.replace(/\D/g, ''),
      addressNumber: params.creditCardHolderInfo.addressNumber,
      phone: params.creditCardHolderInfo.phone.replace(/\D/g, ''),
    },
    remoteIp: params.remoteIp,
  })
}

export async function cancelSubscription(subscriptionId: string): Promise<void> {
  await asaasRequest('DELETE', `/subscriptions/${subscriptionId}`)
}

export async function getSubscription(subscriptionId: string): Promise<AsaasSubscription> {
  return asaasRequest<AsaasSubscription>('GET', `/subscriptions/${subscriptionId}`)
}

// ─── PIX (cobranças avulsas para pacotes de tokens) ───────────────────────────

export interface AsaasPayment {
  id: string
  status: string
  value: number
  dueDate: string
  invoiceUrl?: string
}

export async function createPixCharge(params: {
  customerId: string
  value: number
  description: string
  dueDate: string   // 'YYYY-MM-DD'
}): Promise<AsaasPayment> {
  return asaasRequest<AsaasPayment>('POST', '/payments', {
    customer: params.customerId,
    billingType: 'PIX',
    value: params.value,
    dueDate: params.dueDate,
    description: params.description,
    externalReference: `tokens_${Date.now()}`,
  })
}

export interface AsaasPixQrCode {
  encodedImage: string   // base64 do QR
  payload: string        // copia-e-cola
  expirationDate: string
}

export async function getPixQrCode(paymentId: string): Promise<AsaasPixQrCode> {
  return asaasRequest<AsaasPixQrCode>('GET', `/payments/${paymentId}/pixQrCode`)
}

export async function getPayment(paymentId: string): Promise<AsaasPayment> {
  return asaasRequest<AsaasPayment>('GET', `/payments/${paymentId}`)
}
