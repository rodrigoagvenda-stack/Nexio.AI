/**
 * POST /api/webhooks/payment/[companyId]/[platform]
 *
 * Recebe eventos de pagamento confirmado do Mercado Pago e Kiwify.
 * Fluxo: valida autenticidade → busca lead por email/telefone →
 *        move para Fechado → dispara sequência "pagamento" no canvas.
 *
 * Documentação:
 * - Mercado Pago: https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
 * - Kiwify: https://docs.kiwify.com.br/api-reference/webhooks
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { normalizePhone } from '@/lib/sdr/uazapi'
import { runPaymentSequenceImmediate } from '@/lib/sdr/follow'
import crypto from 'crypto'

const VALID_PLATFORMS = ['mercadopago', 'kiwify', 'asaas'] as const
type Platform = typeof VALID_PLATFORMS[number]

// ─── Mercado Pago: valida assinatura HMAC-SHA256 ─────────────────────────────
function validateMercadoPagoSignature(
  req: NextRequest,
  body: Record<string, any>,
  secretKey: string
): boolean {
  try {
    const xSignature = req.headers.get('x-signature') ?? ''
    const xRequestId = req.headers.get('x-request-id') ?? ''

    // Extrai ts e v1 do header x-signature
    const parts = Object.fromEntries(xSignature.split(',').map(p => p.split('=')))
    const ts = parts['ts']
    const v1 = parts['v1']
    if (!ts || !v1) return false

    const dataId = body?.data?.id ?? ''

    // Template: id:[dataId];request-id:[xRequestId];ts:[ts];
    const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`
    const hash = crypto.createHmac('sha256', secretKey).update(manifest).digest('hex')

    // Comparação timing-safe
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(v1))
  } catch {
    return false
  }
}

// ─── Mercado Pago: busca detalhes do pagamento via API ───────────────────────
async function fetchMercadoPagoPayment(paymentId: string, accessToken: string) {
  const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    console.error(`[payment-webhook:mp] GET /v1/payments/${paymentId} status=${res.status}`)
    return null
  }
  return res.json()
}

// ─── Helper: busca lead por email ou telefone ─────────────────────────────────
async function findLead(companyId: number, email?: string, phone?: string, supabase: any = null) {
  if (email) {
    const { data } = await supabase
      .from('leads')
      .select('id, whatsapp, company_name, contact_name')
      .eq('company_id', companyId)
      .eq('email', email)
      .maybeSingle()
    if (data) return data
  }
  if (phone) {
    const normalized = normalizePhone(phone)
    const { data } = await supabase
      .from('leads')
      .select('id, whatsapp, company_name, contact_name')
      .eq('company_id', companyId)
      .eq('whatsapp', normalized)
      .maybeSingle()
    if (data) return data
  }
  return null
}

export async function POST(
  req: NextRequest,
  { params }: { params: { companyId: string; platform: string } }
) {
  const { companyId: companyIdStr, platform } = params
  const companyId = Number(companyIdStr)

  if (isNaN(companyId) || !VALID_PLATFORMS.includes(platform as Platform)) {
    return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 })
  }

  console.log(`[payment-webhook:${platform}] company=${companyId} recebido`)

  const supabase = createServiceClient()

  // Busca credenciais salvas para esta empresa/plataforma
  const { data: integration } = await supabase
    .from('payment_integrations')
    .select('config, active')
    .eq('company_id', companyId)
    .eq('platform', platform)
    .maybeSingle()

  if (!integration?.active) {
    console.warn(`[payment-webhook:${platform}] company=${companyId} integração não encontrada ou inativa`)
    // Retorna 200 para não causar reenvios da plataforma
    return NextResponse.json({ received: true })
  }

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Body inválido' }, { status: 400 })

  // ─── MERCADO PAGO ───────────────────────────────────────────────────────────
  if (platform === 'mercadopago') {
    const { access_token, secret_key } = integration.config ?? {}

    // Valida assinatura HMAC-SHA256
    if (!validateMercadoPagoSignature(req, body, secret_key)) {
      console.warn(`[payment-webhook:mp] company=${companyId} assinatura inválida`)
      return NextResponse.json({ error: 'Assinatura inválida' }, { status: 401 })
    }

    // Ignora eventos que não são de pagamento
    if (body.type !== 'payment') {
      console.log(`[payment-webhook:mp] company=${companyId} evento ignorado type=${body.type}`)
      return NextResponse.json({ received: true })
    }

    const paymentId = body?.data?.id
    if (!paymentId) return NextResponse.json({ received: true })

    // Busca detalhes completos do pagamento
    const payment = await fetchMercadoPagoPayment(String(paymentId), access_token)
    if (!payment) return NextResponse.json({ received: true })

    // Processa apenas pagamentos aprovados
    if (payment.status !== 'approved') {
      console.log(`[payment-webhook:mp] company=${companyId} pagamento status=${payment.status} — ignorado`)
      return NextResponse.json({ received: true })
    }

    // Extrai dados do comprador
    const email = payment.payer?.email
    const phoneInfo = payment.additional_info?.payer?.phone
    const rawPhone = phoneInfo ? `${phoneInfo.area_code}${phoneInfo.number}` : undefined
    const value = payment.transaction_amount

    console.log(`[payment-webhook:mp] company=${companyId} payment=${paymentId} email=${email} valor=${value}`)

    // Busca lead correspondente
    const lead = await findLead(companyId, email, rawPhone, supabase)
    if (!lead) {
      console.warn(`[payment-webhook:mp] company=${companyId} lead não encontrado email=${email} phone=${rawPhone}`)
      return NextResponse.json({ received: true })
    }

    // Move lead para Fechado + seta valor se não definido
    const updates: Record<string, any> = { status: 'Fechado' }
    if (value && !lead.project_value) updates.project_value = value

    await supabase.from('leads').update(updates).eq('id', lead.id)
    console.log(`[payment-webhook:mp] lead=${lead.id} movido para Fechado valor=${value}`)

    // Dispara sequência "pagamento" em background
    runPaymentSequenceImmediate(companyId, lead.id, { platform: 'mercadopago', eventoEntrada: 'mercadopago', paymentId: String(paymentId), value })
      .then(r => console.log(`[payment-webhook:mp] sequência sent=${r.sent} error=${r.error ?? 'ok'}`))
      .catch(err => console.error(`[payment-webhook:mp] sequência falhou:`, err.message))

    return NextResponse.json({ received: true })
  }

  // ─── KIWIFY ────────────────────────────────────────────────────────────────
  if (platform === 'kiwify') {
    const { token: savedToken } = integration.config ?? {}

    // Valida token no payload (mecanismo oficial Kiwify)
    if (!savedToken || body.token !== savedToken) {
      console.warn(`[payment-webhook:kiwify] company=${companyId} token inválido`)
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
    }

    // Processa apenas vendas confirmadas
    if (body.order_status !== 'paid') {
      console.log(`[payment-webhook:kiwify] company=${companyId} status=${body.order_status} — ignorado`)
      return NextResponse.json({ received: true })
    }

    const email = body.Customer?.email
    const rawPhone = body.Customer?.mobile
    const productName = body.Product?.name
    const value = body.Commissions?.my_commission

    console.log(`[payment-webhook:kiwify] company=${companyId} order=${body.order_id} email=${email} produto="${productName}"`)

    // Busca lead correspondente
    const lead = await findLead(companyId, email, rawPhone, supabase)
    if (!lead) {
      console.warn(`[payment-webhook:kiwify] company=${companyId} lead não encontrado email=${email} phone=${rawPhone}`)
      return NextResponse.json({ received: true })
    }

    // Move lead para Fechado + seta valor se não definido
    const updates: Record<string, any> = { status: 'Fechado' }
    if (value && !lead.project_value) updates.project_value = value

    await supabase.from('leads').update(updates).eq('id', lead.id)
    console.log(`[payment-webhook:kiwify] lead=${lead.id} movido para Fechado produto="${productName}"`)

    // Dispara sequência "pagamento" em background
    runPaymentSequenceImmediate(companyId, lead.id, { platform: 'kiwify', eventoEntrada: 'kiwify', orderId: body.order_id, productName, value })
      .then(r => console.log(`[payment-webhook:kiwify] sequência sent=${r.sent} error=${r.error ?? 'ok'}`))
      .catch(err => console.error(`[payment-webhook:kiwify] sequência falhou:`, err.message))

    return NextResponse.json({ received: true })
  }

  // ─── ASAAS ─────────────────────────────────────────────────────────────────
  if (platform === 'asaas') {
    const { access_token: asaasApiKey, webhook_token: savedToken } = integration.config ?? {}

    // Helper para gravar evento no config.recent_events (últimos 30)
    const logEvent = async (entry: Record<string, any>) => {
      try {
        const { data: cur } = await supabase
          .from('payment_integrations')
          .select('config')
          .eq('company_id', companyId)
          .eq('platform', 'asaas')
          .maybeSingle()
        const prev: any[] = Array.isArray(cur?.config?.recent_events) ? cur.config.recent_events : []
        const recent = [{ ts: new Date().toISOString(), ...entry }, ...prev].slice(0, 30)
        await supabase
          .from('payment_integrations')
          .update({ config: { ...(cur?.config ?? {}), recent_events: recent } })
          .eq('company_id', companyId)
          .eq('platform', 'asaas')
      } catch {}
    }

    // Valida token no header asaas-access-token
    const receivedToken = req.headers.get('asaas-access-token')
    if (!savedToken || receivedToken !== savedToken) {
      await logEvent({ status: 'erro', erro: 'Token inválido no header asaas-access-token', recebido: receivedToken?.slice(0, 8) + '…', esperado: savedToken?.slice(0, 8) + '…' })
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
    }

    const { event, payment } = body ?? {}
    if (!event || !payment?.id) return NextResponse.json({ received: true })

    // Mapeia evento Asaas → eventoEntrada do canvas
    // billingType pode vir "UNDEFINED" em assinaturas recorrentes — usa bankSlipUrl como fallback
    const isBoleto = payment.billingType === 'BOLETO' || (payment.billingType === 'UNDEFINED' && !!payment.bankSlipUrl)
    let eventoEntrada: string | null = null
    if (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') eventoEntrada = 'asaas_pago'
    else if (event === 'PAYMENT_CREATED' && isBoleto) eventoEntrada = 'asaas_boleto_gerado'
    else if (event === 'PAYMENT_OVERDUE' && isBoleto) eventoEntrada = 'asaas_boleto_vencido'

    if (!eventoEntrada) {
      await logEvent({ status: 'ignorado', evento: event, billing_type: payment.billingType, motivo: 'evento não mapeado para nenhum gatilho' })
      return NextResponse.json({ received: true })
    }

    // Busca dados do cliente na API Asaas para obter email/telefone
    const asaasBase = asaasApiKey?.startsWith('$aact_hmlg_')
      ? 'https://api-sandbox.asaas.com/v3'
      : 'https://api.asaas.com/v3'

    const customerId = payment.customer
    if (!customerId) {
      await logEvent({ status: 'erro', evento: event, eventoEntrada, erro: 'payment sem campo customer', payment_id: payment.id })
      return NextResponse.json({ received: true })
    }

    const customerRes = await fetch(`${asaasBase}/customers/${customerId}`, {
      headers: { access_token: asaasApiKey, 'User-Agent': 'Nexio.AI', 'Content-Type': 'application/json' },
    }).catch(() => null)

    const customer = customerRes?.ok ? await customerRes.json().catch(() => null) : null
    const email = customer?.email
    const rawPhone = customer?.mobilePhone ?? customer?.phone
    const value = payment.value

    if (!customerRes?.ok) {
      await logEvent({ status: 'erro', evento: event, eventoEntrada, payment_id: payment.id, customer_id: customerId, erro: `Falha ao buscar cliente no Asaas (status ${customerRes?.status ?? 'sem resposta'})` })
      return NextResponse.json({ received: true })
    }

    // Busca lead por email ou telefone
    const lead = await findLead(companyId, email, rawPhone, supabase)
    if (!lead) {
      await logEvent({ status: 'erro', evento: event, eventoEntrada, payment_id: payment.id, customer_id: customerId, email, telefone: rawPhone, erro: 'Lead não encontrado — nenhum lead com esse e-mail ou telefone no Zaapply' })
      return NextResponse.json({ received: true })
    }

    // Pagamento confirmado: move lead para Fechado
    if (eventoEntrada === 'asaas_pago') {
      const updates: Record<string, any> = { status: 'Fechado' }
      if (value && !lead.project_value) updates.project_value = value
      await supabase.from('leads').update(updates).eq('id', lead.id)
    }

    // Dispara sequência canvas em background + loga resultado
    runPaymentSequenceImmediate(companyId, lead.id, {
      platform: 'asaas',
      eventoEntrada,
      paymentId: payment.id,
      value,
    })
      .then(r => logEvent({ status: r.sent > 0 ? 'ok' : 'sem_sequencia', evento: event, eventoEntrada, payment_id: payment.id, lead_id: lead.id, email, mensagens_enviadas: r.sent, erro: r.error ?? null }))
      .catch(err => logEvent({ status: 'erro', evento: event, eventoEntrada, payment_id: payment.id, lead_id: lead.id, erro: err.message }))

    return NextResponse.json({ received: true })
  }

  return NextResponse.json({ received: true })
}
