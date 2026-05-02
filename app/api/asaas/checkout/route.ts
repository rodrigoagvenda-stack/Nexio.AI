import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getPlatformConfig } from '@/lib/platform-config'

const PLAN_VALUES: Record<string, number> = {
  starter: 397,
  pro: 597,
  scale: 997,
}

const PLAN_LABELS: Record<string, string> = {
  starter: 'Starter',
  pro: 'Pro',
  scale: 'Scale',
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { data: userData } = await supabase
      .from('users')
      .select('company_id, name, email')
      .eq('auth_user_id', user.id)
      .single()
    if (!userData) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

    const body = await request.json()
    const { plan, cpfCnpj: cpfCnpjRaw } = body as { plan: string; cpfCnpj?: string }

    const planValue = PLAN_VALUES[plan]
    if (!planValue) return NextResponse.json({ error: 'Plano inválido' }, { status: 400 })

    const cpfCnpj = (cpfCnpjRaw || '').replace(/\D/g, '')
    if (!cpfCnpj) return NextResponse.json({ error: 'CPF ou CNPJ obrigatório para processar pagamento' }, { status: 400 })

    const cfg = await getPlatformConfig()
    const apiKey = cfg.asaas_api_key
    const baseUrl = cfg.asaas_base_url || 'https://api.asaas.com/v3'

    if (!apiKey) return NextResponse.json({ error: 'Gateway de pagamentos não configurado. Contate o suporte.' }, { status: 503 })

    const service = createServiceClient()
    const { data: company, error: companyError } = await service
      .from('companies')
      .select('id, name, asaas_customer_id, asaas_cpf_cnpj')
      .eq('id', userData.company_id)
      .single()
    if (companyError) {
      console.error('[asaas/checkout] erro ao buscar empresa:', companyError.message, '| company_id:', userData.company_id)
      throw new Error('Erro ao buscar empresa: ' + companyError.message)
    }
    if (!company) return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 })

    const headers = {
      'Content-Type': 'application/json',
      'access_token': apiKey,
    }

    // Salva cpfCnpj na empresa (para uso futuro)
    await service.from('companies').update({ asaas_cpf_cnpj: cpfCnpj }).eq('id', company.id)

    // ── 1. Garantir cliente no Asaas ──────────────────────────────────────────
    let customerId = company.asaas_customer_id

    if (!customerId) {
      // Cria novo customer já com cpfCnpj
      const custRes = await fetch(`${baseUrl}/customers`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: company.name || userData.name || 'Cliente',
          email: userData.email,
          cpfCnpj,
          notificationDisabled: false,
        }),
      })
      const custData = await custRes.json()
      if (!custRes.ok) throw new Error(custData.errors?.[0]?.description || 'Erro ao criar cliente no Asaas')

      customerId = custData.id
      await service.from('companies').update({ asaas_customer_id: customerId }).eq('id', company.id)
    } else {
      // Customer já existe — sempre atualiza cpfCnpj via PUT para garantir que está correto
      const updateRes = await fetch(`${baseUrl}/customers/${customerId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ cpfCnpj }),
      })
      if (!updateRes.ok) {
        const updateErr = await updateRes.json()
        console.error('[asaas/checkout] falha ao atualizar customer:', updateErr)
        throw new Error(updateErr.errors?.[0]?.description || 'Erro ao atualizar cliente no Asaas')
      }
    }

    // ── 2. Criar assinatura ───────────────────────────────────────────────────
    const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD

    const subRes = await fetch(`${baseUrl}/subscriptions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        customer: customerId,
        billingType: 'UNDEFINED', // cliente escolhe PIX, boleto ou cartão
        value: planValue,
        nextDueDate: today,
        cycle: 'MONTHLY',
        description: `Nexio AI — Plano ${PLAN_LABELS[plan]}`,
      }),
    })
    const subData = await subRes.json()
    if (!subRes.ok) throw new Error(subData.errors?.[0]?.description || 'Erro ao criar assinatura')

    const subscriptionId = subData.id

    // Salva subscription ID imediatamente
    await service.from('companies').update({
      asaas_subscription_id: subscriptionId,
      plan_type: plan,
      subscription_start_date: today,
    }).eq('id', company.id)

    // ── 3. Buscar primeiro pagamento para obter URL de fatura ─────────────────
    const paymentsRes = await fetch(`${baseUrl}/subscriptions/${subscriptionId}/payments`, { headers })
    const paymentsData = await paymentsRes.json()
    const firstPayment = paymentsData.data?.[0]

    const invoiceUrl = firstPayment?.invoiceUrl || firstPayment?.bankSlipUrl || subData.invoiceUrl

    if (!invoiceUrl) {
      // Sem URL de fatura — assinatura criada mas pagamento ainda não gerado
      return NextResponse.json({
        url: null,
        message: 'Assinatura criada! Você receberá o link de pagamento por email em instantes.',
        subscriptionId,
      })
    }

    return NextResponse.json({ url: invoiceUrl })
  } catch (err: any) {
    console.error('[asaas/checkout]', err)
    return NextResponse.json({ error: err.message || 'Erro ao processar checkout' }, { status: 500 })
  }
}
