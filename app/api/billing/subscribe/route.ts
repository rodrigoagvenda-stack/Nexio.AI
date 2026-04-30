/**
 * POST /api/billing/subscribe
 *
 * Cria ou atualiza assinatura recorrente via cartão de crédito.
 * Chamado pelo admin da empresa quando escolhe/troca de plano.
 *
 * Body:
 *   plan            'starter' | 'pro' | 'scale'
 *   cpfCnpj         CPF ou CNPJ do titular
 *   creditCard      { holderName, number, expiryMonth, expiryYear, ccv }
 *   holderInfo      { name, email, cpfCnpj, postalCode, addressNumber, phone }
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { createServiceClient } from '@/lib/supabase/server'
import {
  createOrGetCustomer,
  createSubscription,
  cancelSubscription,
} from '@/lib/asaas/client'

// Mapeia plan_type → valor mensal
const PLAN_PRICES: Record<string, number> = {
  starter: 1600,
  pro:     2000,
  scale:   2600,
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export async function POST(request: NextRequest) {
  const { context, error: authError } = await requireAuth(request)
  if (authError) return authError

  if (context.role !== 'admin' && context.role !== 'company_admin') {
    return NextResponse.json({ success: false, message: 'Apenas administradores' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { plan, cpfCnpj, creditCard, holderInfo } = body

    if (!PLAN_PRICES[plan]) {
      return NextResponse.json({ success: false, message: `Plano inválido: ${plan}` }, { status: 400 })
    }
    if (!cpfCnpj || !creditCard || !holderInfo) {
      return NextResponse.json({ success: false, message: 'Dados obrigatórios: cpfCnpj, creditCard, holderInfo' }, { status: 400 })
    }

    const supabase = createServiceClient()

    const { data: company } = await supabase
      .from('companies')
      .select('id, name, email, asaas_customer_id, asaas_subscription_id')
      .eq('id', context.companyId)
      .single()

    if (!company) return NextResponse.json({ success: false, message: 'Empresa não encontrada' }, { status: 404 })

    // 1. Criar ou recuperar cliente Asaas
    const customer = await createOrGetCustomer({
      name: company.name,
      email: company.email,
      cpfCnpj,
    })

    // 2. Cancelar assinatura anterior se existir
    if (company.asaas_subscription_id) {
      await cancelSubscription(company.asaas_subscription_id).catch(() => {})
    }

    // 3. Criar nova assinatura
    const forwardedFor = request.headers.get('x-forwarded-for') ?? '127.0.0.1'
    const remoteIp = forwardedFor.split(',')[0].trim()

    const subscription = await createSubscription({
      customerId: customer.id,
      value: PLAN_PRICES[plan],
      description: `Zaapli ${plan.charAt(0).toUpperCase() + plan.slice(1)} — mensal`,
      nextDueDate: todayISO(),
      creditCard,
      creditCardHolderInfo: holderInfo,
      remoteIp,
    })

    // 4. Persistir no companies
    const now = new Date().toISOString()
    await supabase.from('companies').update({
      plan_type: plan,
      asaas_customer_id: customer.id,
      asaas_subscription_id: subscription.id,
      asaas_cpf_cnpj: cpfCnpj,
      subscription_start_date: now,
      subscription_expires_at: new Date(Date.now() + 31 * 24 * 60 * 60 * 1000).toISOString(),
      is_active: true,
    }).eq('id', context.companyId)

    return NextResponse.json({
      success: true,
      subscriptionId: subscription.id,
      nextDueDate: subscription.nextDueDate,
    })
  } catch (err: any) {
    console.error('[billing/subscribe]', err)
    return NextResponse.json({ success: false, message: err.message }, { status: 500 })
  }
}
