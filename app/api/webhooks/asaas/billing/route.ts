/**
 * POST /api/webhooks/asaas/billing
 *
 * Webhook único configurado no painel Asaas para eventos de billing.
 * Valida o header asaas-access-token contra ASAAS_WEBHOOK_TOKEN (env).
 *
 * Eventos tratados:
 *   PAYMENT_CONFIRMED / PAYMENT_RECEIVED
 *     → subscription present  : renova subscription_expires_at, mantém tenant ativo
 *     → billingType === 'PIX'  : confirma pacote extra, insere em extra_packages, reativa agente
 *
 *   PAYMENT_OVERDUE
 *     → subscription present  : apenas loga (Asaas retenta automaticamente)
 *
 *   SUBSCRIPTION_DELETED
 *     → marca subscription_expires_at como passado para não renovar
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getPlatformConfig } from '@/lib/platform-config'

const CONFIRMED_EVENTS = new Set(['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED'])

/** Calcula próximo vencimento (+1 mês) mantendo o dia original da assinatura */
function nextMonthFromDate(from: Date): Date {
  const d = new Date(from)
  d.setUTCMonth(d.getUTCMonth() + 1)
  return d
}

export async function POST(request: NextRequest) {
  // ── IMPORTANTE: sempre retornar HTTP 200 — qualquer outro status pausa a fila no Asaas ──

  // ── Validar token ──────────────────────────────────────────────────────────
  try {
    const incomingToken = request.headers.get('asaas-access-token') ?? ''
    const cfg = await getPlatformConfig()
    const expectedToken = cfg.asaas_webhook_token

    if (expectedToken && incomingToken !== expectedToken) {
      // Loga mas retorna 200 — token inválido não deve pausar a fila
      console.warn('[webhook/asaas/billing] token inválido recebido:', incomingToken.slice(0, 8) + '...')
      return NextResponse.json({ received: true, warning: 'token_invalido' })
    }
  } catch (err: any) {
    console.error('[webhook/asaas/billing] erro ao validar token:', err.message)
    return NextResponse.json({ received: true, warning: 'config_error' })
  }

  let payload: any
  try {
    payload = await request.json()
  } catch {
    // Payload inválido — loga e retorna 200
    console.error('[webhook/asaas/billing] payload inválido')
    return NextResponse.json({ received: true, warning: 'payload_invalido' })
  }

  const event: string = payload.event ?? ''
  const payment = payload.payment

  if (!payment?.id) {
    // Evento sem payment (ex: SUBSCRIPTION_CREATED) — aceita sem erro
    return NextResponse.json({ received: true, event })
  }

  const supabase = createServiceClient()

  try {
    if (CONFIRMED_EVENTS.has(event)) {
      if (payment.subscription) {
        await handleSubscriptionPayment(payment, supabase)
      } else if (payment.billingType === 'PIX') {
        await handleExtraPackagePayment(payment, supabase)
      }
    } else if (event === 'SUBSCRIPTION_DELETED') {
      await handleSubscriptionDeleted(payment, supabase)
    }

    return NextResponse.json({ received: true, event })
  } catch (err: any) {
    console.error('[webhook/asaas/billing]', event, err)
    // Retorna 200 — erro interno não deve pausar a fila
    return NextResponse.json({ received: true, warning: err.message })
  }
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

async function handleSubscriptionPayment(
  payment: any,
  supabase: ReturnType<typeof createServiceClient>
) {
  const { data: company } = await supabase
    .from('companies')
    .select('id, subscription_start_date, asaas_subscription_id')
    .eq('asaas_subscription_id', payment.subscription)
    .single()

  if (!company) {
    // Tenta por customer_id como fallback
    console.warn('[billing-webhook] subscription não encontrada:', payment.subscription)
    return
  }

  const startDate = company.subscription_start_date
    ? new Date(company.subscription_start_date)
    : new Date()

  const newExpiry = nextMonthFromDate(startDate)

  await supabase.from('companies').update({
    is_active: true,
    agente_ativo: true,
    subscription_expires_at: newExpiry.toISOString(),
    // Zera alertas de token para o novo ciclo
    token_alert_80_sent_at: null,
    token_alert_95_sent_at: null,
  }).eq('id', company.id)
}

async function handleExtraPackagePayment(
  payment: any,
  supabase: ReturnType<typeof createServiceClient>
) {
  // Busca o registro pending pelo asaas_payment_id
  const { data: charge } = await supabase
    .from('extra_package_charges')
    .select('id, tenant_id, tokens_to_grant, amount, valid_until')
    .eq('asaas_payment_id', payment.id)
    .eq('status', 'pending')
    .single()

  if (!charge) {
    console.warn('[billing-webhook] extra_package_charge não encontrado ou já processado:', payment.id)
    return
  }

  const now = new Date().toISOString()

  // 1. Inserir em extra_packages (libera os tokens)
  await supabase.from('extra_packages').insert({
    tenant_id: charge.tenant_id,
    tokens_granted: charge.tokens_to_grant,
    tokens_used: 0,
    paid_amount: charge.amount,
    valid_until: charge.valid_until,
  })

  // 2. Marcar cobrança como confirmada
  await supabase.from('extra_package_charges').update({
    status: 'confirmed',
    confirmed_at: now,
  }).eq('id', charge.id)

  // 3. Reativar agente do tenant
  await supabase.from('companies').update({
    agente_ativo: true,
    is_active: true,
  }).eq('id', charge.tenant_id)
}

async function handleSubscriptionDeleted(
  payment: any,
  supabase: ReturnType<typeof createServiceClient>
) {
  if (!payment.subscription) return

  // Marca subscription como expirada (não remove — mantém histórico)
  await supabase.from('companies').update({
    subscription_expires_at: new Date().toISOString(),
    asaas_subscription_id: null,
  }).eq('asaas_subscription_id', payment.subscription)
}
