/**
 * lib/asaas/client.ts
 * Wrapper para a API ASAAS v3.
 * Credenciais lidas do banco via getPlatformConfig (admin → Configurações).
 * Docs: https://docs.asaas.com
 */

import { getPlatformConfig } from '@/lib/platform-config'

async function asaasRequest<T = any>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: object,
  _retries = 1,
): Promise<T> {
  const cfg = await getPlatformConfig()

  const baseUrl = cfg.asaas_base_url || 'https://api-sandbox.asaas.com/v3'
  const apiKey  = cfg.asaas_api_key

  if (!apiKey) throw new Error('ASAAS API Key não configurada. Acesse Admin → Configurações → ASAAS.')

  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'access_token': apiKey,
      'Content-Type': 'application/json',
      'User-Agent': 'zaapply/1.0',
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  })

  // 429 : rate limit: aguarda retry-after e tenta mais uma vez
  if (res.status === 429 && _retries > 0) {
    const retryAfter = parseInt(res.headers.get('retry-after') || '5', 10)
    await new Promise(resolve => setTimeout(resolve, retryAfter * 1000))
    return asaasRequest<T>(method, path, body, _retries - 1)
  }

  // Parse seguro : Asaas retorna HTML quando a chave é inválida ou a URL está errada
  const text = await res.text()
  let data: any
  try {
    data = JSON.parse(text)
  } catch {
    console.error(`[asaas] resposta não-JSON (${res.status}) ${method} ${path}:`, text.slice(0, 200))
    throw new Error(`Erro na integração Asaas (${res.status}). Verifique a chave de API e a URL base nas configurações.`)
  }

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

export async function updateCustomer(
  customerId: string,
  params: { name?: string; email?: string; cpfCnpj?: string },
): Promise<AsaasCustomer> {
  return asaasRequest<AsaasCustomer>('PUT', `/customers/${customerId}`, {
    ...params,
    ...(params.cpfCnpj ? { cpfCnpj: params.cpfCnpj.replace(/\D/g, '') } : {}),
  })
}

export async function createOrGetCustomer(params: {
  name: string
  email: string
  cpfCnpj: string
  existingCustomerId?: string
  externalReference?: string
}): Promise<AsaasCustomer> {
  if (params.existingCustomerId) {
    return updateCustomer(params.existingCustomerId, {
      name: params.name,
      email: params.email,
      cpfCnpj: params.cpfCnpj,
    })
  }

  const search = await asaasRequest<{ data: AsaasCustomer[] }>(
    'GET',
    `/customers?cpfCnpj=${params.cpfCnpj.replace(/\D/g, '')}`
  )

  if (search.data?.length) {
    return updateCustomer(search.data[0].id, {
      name: params.name,
      cpfCnpj: params.cpfCnpj,
    })
  }

  return asaasRequest<AsaasCustomer>('POST', '/customers', {
    name: params.name,
    email: params.email,
    cpfCnpj: params.cpfCnpj.replace(/\D/g, ''),
    notificationDisabled: false,
    externalReference: params.externalReference,
  })
}

// ─── Subscriptions ────────────────────────────────────────────────────────────

export interface AsaasSubscription {
  id: string
  status: string
  nextDueDate: string
  value: number
  externalReference?: string
}

// ─── Tokenização de cartão ────────────────────────────────────────────────────

export interface AsaasCreditCardToken {
  creditCardNumber: string  // últimos 4 dígitos mascarados
  creditCardBrand: string
  creditCardToken: string   // token opaco para uso futuro
}

/**
 * Tokeniza o cartão diretamente no Asaas e retorna um token opaco.
 * Depois de chamar isso, os dados raw do cartão devem ser descartados imediatamente.
 * Use o token em createSubscription() para criar a assinatura sem retransmitir o cartão.
 */
export async function tokenizeCreditCard(params: {
  customerId: string
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
}): Promise<AsaasCreditCardToken> {
  return asaasRequest<AsaasCreditCardToken>('POST', '/creditCards/tokenizate', {
    customer: params.customerId,
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

export async function createSubscription(params: {
  customerId: string
  value: number
  description: string
  nextDueDate: string
  externalReference?: string
  creditCardToken: string
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
    externalReference: params.externalReference,
    creditCardToken: params.creditCardToken,
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

export async function listSubscriptionsByExternalRef(externalReference: string): Promise<AsaasSubscription[]> {
  const res = await asaasRequest<{ data: AsaasSubscription[] }>(
    'GET',
    `/subscriptions?externalReference=${encodeURIComponent(externalReference)}`
  )
  return res.data ?? []
}

export async function cancelSubscription(subscriptionId: string): Promise<void> {
  await asaasRequest('DELETE', `/subscriptions/${subscriptionId}`)
}

export async function getSubscription(subscriptionId: string): Promise<AsaasSubscription> {
  return asaasRequest<AsaasSubscription>('GET', `/subscriptions/${subscriptionId}`)
}

// ─── Payments ─────────────────────────────────────────────────────────────────

export interface AsaasPayment {
  id: string
  status: string
  value: number
  dueDate: string
  paymentDate?: string
  subscription?: string
  customer?: string
  billingType?: string
  invoiceUrl?: string
  bankSlipUrl?: string
  externalReference?: string
}

export async function createPixCharge(params: {
  customerId: string
  value: number
  description: string
  dueDate: string
  externalReference?: string
}): Promise<AsaasPayment> {
  return asaasRequest<AsaasPayment>('POST', '/payments', {
    customer: params.customerId,
    billingType: 'PIX',
    value: params.value,
    dueDate: params.dueDate,
    description: params.description,
    externalReference: params.externalReference ?? `tokens_${Date.now()}`,
  })
}

export interface AsaasPixQrCode {
  encodedImage: string
  payload: string
  expirationDate: string
}

export async function getPixQrCode(paymentId: string): Promise<AsaasPixQrCode> {
  return asaasRequest<AsaasPixQrCode>('GET', `/payments/${paymentId}/pixQrCode`)
}

export async function getPayment(paymentId: string): Promise<AsaasPayment> {
  return asaasRequest<AsaasPayment>('GET', `/payments/${paymentId}`)
}
