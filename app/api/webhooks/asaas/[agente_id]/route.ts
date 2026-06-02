import { createServiceClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'

export async function POST(
  request: NextRequest,
  { params }: { params: { agente_id: string } }
) {
  // ── Rate limiting ─────────────────────────────────────────────────────────
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
  const rl = rateLimit({ key: `asaas-agente:${ip}`, limit: 120, windowMs: 60_000 })
  if (!rl.success) {
    console.warn('[webhook/agente] rate limit excedido:', ip)
    return NextResponse.json({ received: true, warning: 'rate_limit' })
  }

  // ── Parse do payload antecipado — falha antes de qualquer DB call ─────────
  let payload: any
  try {
    payload = await request.json()
  } catch {
    console.error('[webhook/agente] payload inválido')
    return NextResponse.json({ received: true, warning: 'payload_invalido' })
  }

  // serviceClient — webhook não tem sessão de usuário, precisa de service role
  const supabase = createServiceClient()

  try {
    // ── Busca agente pelo webhook_id ────────────────────────────────────────
    const { data: agente, error: agenteError } = await supabase
      .from('asaas_agentes')
      .select('id, webhook_secret')
      .eq('webhook_id', params.agente_id)
      .eq('active', true)
      .single()

    if (agenteError || !agente) {
      console.warn('[webhook/agente] agente não encontrado ou inativo:', params.agente_id)
      // Retorna 200 — non-2xx pausa a fila Asaas após 15 falhas
      return NextResponse.json({ received: true, warning: 'agente_nao_encontrado' })
    }

    // ── Validar token ───────────────────────────────────────────────────────
    const asaasToken = request.headers.get('asaas-access-token')

    if (!agente.webhook_secret) {
      console.error('[webhook/agente] agente sem webhook_secret configurado:', agente.id)
      return NextResponse.json({ received: true, warning: 'sem_secret' })
    }

    if (asaasToken !== agente.webhook_secret) {
      console.warn('[webhook/agente] token inválido para agente:', agente.id)
      return NextResponse.json({ received: true, warning: 'token_invalido' })
    }

    const event: string = payload.event ?? ''
    const payment = payload.payment

    if (!payment?.id) {
      return NextResponse.json({ received: true, event })
    }

    // ── Idempotência ────────────────────────────────────────────────────────
    const eventKey = `agente_${agente.id}:${event}:${payment.id}`
    const { error: idempotencyError } = await supabase
      .from('webhook_events')
      .insert({ event_key: eventKey, event, payment_id: payment.id })

    if (idempotencyError) {
      if (idempotencyError.code === '23505') {
        return NextResponse.json({ received: true, duplicate: true })
      }
      console.warn('[webhook/agente] idempotency insert falhou:', idempotencyError.message)
    }

    // ── Upsert cobrança ─────────────────────────────────────────────────────
    // payment.customer é string ID (ex: "cus_xxx"), não um objeto
    const cobrancaData = {
      agente_id:       agente.id,
      asaas_id:        payment.id,
      asaas_customer_id: typeof payment.customer === 'string' ? payment.customer : null,
      valor:           Number(payment.value ?? 0),
      status:          payment.status,
      vencimento:      payment.dueDate ?? null,
      pago_em:         payment.paymentDate ?? null,
      webhook_payload: payload,
      updated_at:      new Date().toISOString(),
    }

    const { data: existing } = await supabase
      .from('asaas_cobrancas')
      .select('id')
      .eq('asaas_id', payment.id)
      .maybeSingle()

    if (existing) {
      await supabase
        .from('asaas_cobrancas')
        .update(cobrancaData)
        .eq('id', existing.id)
    } else {
      await supabase
        .from('asaas_cobrancas')
        .insert(cobrancaData)
    }

    return NextResponse.json({ received: true, event })
  } catch (error: any) {
    console.error('[webhook/agente] erro ao processar:', error)
    // Sempre 200 — erros internos não devem pausar a fila Asaas
    return NextResponse.json({ received: true, warning: error.message ?? 'erro_interno' })
  }
}
