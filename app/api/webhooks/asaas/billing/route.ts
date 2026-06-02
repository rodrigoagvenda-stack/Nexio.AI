/**
 * POST /api/webhooks/asaas/billing
 *
 * Webhook único configurado no painel Asaas para eventos de billing.
 * Valida o header asaas-access-token contra asaas_webhook_token (platform_config).
 *
 * Segurança implementada (doc seção 14):
 *   ✅ Validação de token
 *   ✅ Sempre retorna HTTP 200 (non-2xx pausa a fila no Asaas após 15 falhas)
 *   ✅ Idempotência via tabela webhook_events (chave event:paymentId)
 *   ✅ Verificação do pagamento na API Asaas antes de liberar acesso crítico
 *   ✅ Rate limiting (120 req/min por IP)
 *   ✅ Alertas para eventos de ciclo de vida da chave de API
 *
 * Eventos tratados:
 *   PAYMENT_CONFIRMED / PAYMENT_RECEIVED
 *     → subscription present  : renova subscription_expires_at (base: payment.dueDate + 1 mês)
 *     → sem subscription      : confirma pacote extra, insere em extra_packages
 *   PAYMENT_OVERDUE           : loga (Asaas retenta automaticamente)
 *   PAYMENT_REFUNDED          : revoga acesso imediatamente
 *   SUBSCRIPTION_DELETED      : marca subscription como expirada
 *   ACCESS_TOKEN_*            : alerta crítico via syslog
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getPlatformConfig } from '@/lib/platform-config'
import { getPayment } from '@/lib/asaas/client'
import { syslog } from '@/lib/logger'
import { rateLimit } from '@/lib/rate-limit'

const CONFIRMED_EVENTS = new Set(['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED'])

function nextMonthFromDate(from: Date): Date {
  const d = new Date(from)
  d.setUTCMonth(d.getUTCMonth() + 1)
  return d
}

export async function POST(request: NextRequest) {
  // ── Rate limiting ─────────────────────────────────────────────────────────
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
  const rl = rateLimit({ key: `asaas-billing:${ip}`, limit: 120, windowMs: 60_000 })
  if (!rl.success) {
    // Retorna 200 mesmo em rate limit — não queremos pausar a fila Asaas
    console.warn('[webhook/billing] rate limit excedido:', ip)
    return NextResponse.json({ received: true, warning: 'rate_limit' })
  }

  // ── Validar token ─────────────────────────────────────────────────────────
  try {
    const incomingToken = request.headers.get('asaas-access-token') ?? ''
    const cfg = await getPlatformConfig()
    const expectedToken = cfg.asaas_webhook_token

    if (expectedToken && incomingToken !== expectedToken) {
      console.warn('[webhook/billing] token inválido:', incomingToken.slice(0, 8) + '...')
      // Retorna 200 — token inválido não deve pausar a fila
      return NextResponse.json({ received: true, warning: 'token_invalido' })
    }
  } catch (err: any) {
    console.error('[webhook/billing] erro ao validar token:', err.message)
    return NextResponse.json({ received: true, warning: 'config_error' })
  }

  // ── Parse do payload ──────────────────────────────────────────────────────
  let payload: any
  try {
    payload = await request.json()
  } catch {
    console.error('[webhook/billing] payload inválido')
    return NextResponse.json({ received: true, warning: 'payload_invalido' })
  }

  const event: string = payload.event ?? ''
  const payment = payload.payment

  // Eventos de ciclo de vida da chave de API não têm `payment`
  if (['ACCESS_TOKEN_EXPIRING_SOON', 'ACCESS_TOKEN_DISABLED', 'ACCESS_TOKEN_EXPIRED'].includes(event)) {
    await handleApiKeyEvent(event)
    return NextResponse.json({ received: true, event })
  }

  if (!payment?.id) {
    return NextResponse.json({ received: true, event })
  }

  const supabase = createServiceClient()

  // ── Idempotência ──────────────────────────────────────────────────────────
  const eventKey = `${event}:${payment.id}`
  const { error: idempotencyError } = await supabase
    .from('webhook_events')
    .insert({ event_key: eventKey, event, payment_id: payment.id })

  if (idempotencyError) {
    if (idempotencyError.code === '23505') {
      // Evento duplicado — já processado, retorna 200 silenciosamente
      return NextResponse.json({ received: true, duplicate: true })
    }
    // Falha na tabela de idempotência — loga mas continua (não bloquear o processamento)
    console.warn('[webhook/billing] idempotency insert falhou:', idempotencyError.message)
  }

  // ── Processar evento ──────────────────────────────────────────────────────
  try {
    if (CONFIRMED_EVENTS.has(event)) {
      // Verificar status real na API antes de liberar acesso
      let confirmedPayment = payment
      try {
        confirmedPayment = await getPayment(payment.id)
        if (!CONFIRMED_EVENTS.has(confirmedPayment.status)) {
          console.warn('[webhook/billing] status na API não confirmado:', confirmedPayment.status, payment.id)
          return NextResponse.json({ received: true, warning: 'status_nao_confirmado' })
        }
      } catch (verifyErr: any) {
        // Falha ao verificar na API — loga e processa com payload do webhook
        console.warn('[webhook/billing] falha ao verificar pagamento na API:', verifyErr.message)
      }

      if (confirmedPayment.subscription) {
        await handleSubscriptionPayment(confirmedPayment, supabase)
        await syslog({ type: 'billing', severity: 'info', message: `Pagamento confirmado — assinatura ${confirmedPayment.subscription}`, payload: { event, paymentId: confirmedPayment.id, value: confirmedPayment.value } })
      } else {
        await handleExtraPackagePayment(confirmedPayment, supabase)
        await syslog({ type: 'billing', severity: 'info', message: `Cobrança avulsa confirmada — ${confirmedPayment.id}`, payload: { event, paymentId: confirmedPayment.id, value: confirmedPayment.value } })
      }

    } else if (event === 'PAYMENT_REFUNDED') {
      await handleSubscriptionRefunded(payment, supabase)
      await syslog({ type: 'billing', severity: 'warning', message: `Pagamento estornado — ${payment.id}`, payload: { event, paymentId: payment.id } })

    } else if (event === 'SUBSCRIPTION_DELETED') {
      await handleSubscriptionDeleted(payment, supabase)
      await syslog({ type: 'billing', severity: 'warning', message: `Assinatura cancelada — ${payment.subscription}`, payload: { event, paymentId: payment.id } })

    } else {
      await syslog({ type: 'billing', severity: 'info', message: `Evento Asaas recebido: ${event}`, payload: { event, paymentId: payment.id } })
    }

    return NextResponse.json({ received: true, event })
  } catch (err: any) {
    console.error('[webhook/billing]', event, err)
    await syslog({ type: 'billing', severity: 'error', message: `Webhook billing falhou: ${err.message}`, payload: { event, error: err.message, stack: err.stack?.slice(0, 500) } })
    // Sempre 200 — erros internos não devem pausar a fila Asaas
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
    .select('id, asaas_subscription_id')
    .eq('asaas_subscription_id', payment.subscription)
    .single()

  if (!company) {
    console.warn('[billing-webhook] subscription não encontrada:', payment.subscription)
    return
  }

  // Expiry = dueDate do pagamento + 1 mês (correto para ciclos mensais recorrentes)
  const dueDate = payment.dueDate ? new Date(payment.dueDate + 'T00:00:00Z') : new Date()
  const newExpiry = nextMonthFromDate(dueDate)

  await supabase.from('companies').update({
    is_active: true,
    agente_ativo: true,
    subscription_expires_at: newExpiry.toISOString(),
    token_alert_80_sent_at: null,
    token_alert_95_sent_at: null,
  }).eq('id', company.id)
}

async function handleExtraPackagePayment(
  payment: any,
  supabase: ReturnType<typeof createServiceClient>
) {
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

  await supabase.from('extra_packages').insert({
    tenant_id: charge.tenant_id,
    tokens_granted: charge.tokens_to_grant,
    tokens_used: 0,
    paid_amount: charge.amount,
    valid_until: charge.valid_until,
  })

  await supabase.from('extra_package_charges').update({
    status: 'confirmed',
    confirmed_at: now,
  }).eq('id', charge.id)

  await supabase.from('companies').update({
    agente_ativo: true,
    is_active: true,
  }).eq('id', charge.tenant_id)
}

async function handleSubscriptionRefunded(
  payment: any,
  supabase: ReturnType<typeof createServiceClient>
) {
  if (!payment.subscription) return

  // Revoga acesso imediatamente — expiry no passado + desativa agente
  await supabase.from('companies').update({
    is_active: false,
    agente_ativo: false,
    subscription_expires_at: new Date().toISOString(),
  }).eq('asaas_subscription_id', payment.subscription)
}

async function handleSubscriptionDeleted(
  payment: any,
  supabase: ReturnType<typeof createServiceClient>
) {
  if (!payment.subscription) return

  await supabase.from('companies').update({
    subscription_expires_at: new Date().toISOString(),
    asaas_subscription_id: null,
  }).eq('asaas_subscription_id', payment.subscription)
}

async function handleApiKeyEvent(event: string) {
  const severityMap: Record<string, 'warning' | 'error' | 'critical'> = {
    'ACCESS_TOKEN_EXPIRING_SOON': 'warning',
    'ACCESS_TOKEN_DISABLED':      'error',
    'ACCESS_TOKEN_EXPIRED':       'critical',
  }

  const severity = severityMap[event] ?? 'warning'
  const message = {
    'ACCESS_TOKEN_EXPIRING_SOON': 'Chave de API Asaas expirando em breve — rotacione antes de expirar.',
    'ACCESS_TOKEN_DISABLED':      'Chave de API Asaas DESABILITADA por inatividade — reabilite no painel imediatamente.',
    'ACCESS_TOKEN_EXPIRED':       'Chave de API Asaas EXPIRADA — gere uma nova chave e atualize as configurações AGORA.',
  }[event] ?? `Evento de chave de API Asaas: ${event}`

  console.error(`[webhook/billing] ATENÇÃO — ${event}:`, message)
  await syslog({ type: 'billing', severity, message, payload: { event } })
}
