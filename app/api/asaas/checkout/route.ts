import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getPlatformConfig } from '@/lib/platform-config'

const PLAN_VALUES: Record<string, number> = {
  starter: 297,
  pro: 497,
}

const PLAN_LABELS: Record<string, string> = {
  starter: 'Zaapply Start',
  pro: 'Zaapply Growth',
}

async function asaasJson(res: Response, label: string) {
  const text = await res.text()
  try { return JSON.parse(text) } catch {
    console.error(`[asaas/${label}] resposta não-JSON (${res.status}):`, text.slice(0, 200))
    throw new Error(`Erro na integração Asaas (${res.status}). Verifique a chave de API nas configurações.`)
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { data: userData } = await supabase
      .from('users')
      .select('company_id, name, email, role')
      .eq('auth_user_id', user.id)
      .single()
    if (!userData) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

    if (!['admin', 'company_admin'].includes(userData.role ?? '')) {
      return NextResponse.json({ error: 'Apenas administradores podem iniciar assinatura' }, { status: 403 })
    }

    const body = await request.json()
    const { plan, cpfCnpj: cpfCnpjRaw, extraNumbers: extraNumbersRaw, fullName, mobilePhone } = body as { plan: string; cpfCnpj?: string; extraNumbers?: number; fullName?: string; mobilePhone?: string }

    const basePlanValue = PLAN_VALUES[plan]
    if (!basePlanValue) return NextResponse.json({ error: 'Plano inválido' }, { status: 400 })
    const extraNumbers = Math.max(0, Math.min(9, Number(extraNumbersRaw) || 0))
    const planValue = basePlanValue + extraNumbers * 97

    const cpfCnpj = (cpfCnpjRaw || '').replace(/\D/g, '')
    if (!cpfCnpj) return NextResponse.json({ error: 'CPF ou CNPJ obrigatório para processar pagamento' }, { status: 400 })

    const cfg = await getPlatformConfig()
    const apiKey = cfg.asaas_api_key
    const baseUrl = cfg.asaas_base_url || 'https://api.asaas.com/v3'

    if (!apiKey) return NextResponse.json({ error: 'Gateway de pagamentos não configurado. Contate o suporte.' }, { status: 503 })

    const service = createServiceClient()
    const { data: company, error: companyError } = await service
      .from('companies')
      .select('id, name, asaas_customer_id, asaas_cpf_cnpj, asaas_subscription_id')
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

    // Save extra profile data if provided (user may have signed up via Google with no phone)
    const profileUpdates: Record<string, string> = {}
    if (fullName?.trim()) profileUpdates.name = fullName.trim()
    if (mobilePhone?.trim()) profileUpdates.phone = mobilePhone.replace(/\D/g, '')
    if (Object.keys(profileUpdates).length) {
      await service.from('users').update(profileUpdates).eq('auth_user_id', user.id)
    }

    const customerName = fullName?.trim() || userData.name || company.name || 'Cliente'
    const customerPhone = mobilePhone?.replace(/\D/g, '') || undefined

    await service.from('companies').update({ asaas_cpf_cnpj: cpfCnpj }).eq('id', company.id)

    // ── 1. Garantir cliente no Asaas ──────────────────────────────────────────
    let customerId = company.asaas_customer_id
    const customerExtRef = `nexio_company_${company.id}`

    if (!customerId) {
      // Busca por externalReference antes de criar (anti-duplicata em retry)
      const searchRes = await fetch(`${baseUrl}/customers?externalReference=${customerExtRef}`, { headers })
      const searchData = await asaasJson(searchRes, 'search-customer')
      const existing = searchData.data?.[0]

      if (existing?.id) {
        customerId = existing.id
        await service.from('companies').update({ asaas_customer_id: customerId }).eq('id', company.id)
      } else {
        const custRes = await fetch(`${baseUrl}/customers`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            name: customerName,
            email: userData.email,
            cpfCnpj,
            ...(customerPhone ? { mobilePhone: customerPhone } : {}),
            notificationDisabled: false,
            externalReference: customerExtRef,
          }),
        })
        const custData = await asaasJson(custRes, 'create-customer')
        if (!custRes.ok) throw new Error(custData.errors?.[0]?.description || 'Erro ao criar cliente no Asaas')

        customerId = custData.id
        await service.from('companies').update({ asaas_customer_id: customerId }).eq('id', company.id)
      }
    } else {
      // Verifica se o cliente foi soft-deleted no Asaas antes de tentar atualizar
      const getRes = await fetch(`${baseUrl}/customers/${customerId}`, { headers })
      const needsRecreate = !getRes.ok || (await getRes.json().catch(() => ({}))).deleted === true

      if (needsRecreate) {
        console.warn('[asaas/checkout] customer deletado ou não encontrado, recriando:', customerId)
        await service.from('companies').update({ asaas_customer_id: null, asaas_subscription_id: null }).eq('id', company.id)
        const custRes = await fetch(`${baseUrl}/customers`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            name: customerName,
            email: userData.email,
            cpfCnpj,
            ...(customerPhone ? { mobilePhone: customerPhone } : {}),
            notificationDisabled: false,
            externalReference: customerExtRef,
          }),
        })
        const custData = await asaasJson(custRes, 'recreate-customer')
        if (!custRes.ok) throw new Error(custData.errors?.[0]?.description || 'Erro ao recriar cliente no Asaas')
        customerId = custData.id
        await service.from('companies').update({ asaas_customer_id: customerId }).eq('id', company.id)
      } else {
        await fetch(`${baseUrl}/customers/${customerId}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({ cpfCnpj }),
        })
      }
    }

    // ── 2. Criar assinatura (com check anti-duplicata) ────────────────────────
    const today = new Date().toISOString().split('T')[0]
    const subExtRef = `nexio_sub_${company.id}_${plan}`

    // Se já existe assinatura salva no banco, retorna invoice dela
    if (company.asaas_subscription_id) {
      const paymentsRes = await fetch(`${baseUrl}/subscriptions/${company.asaas_subscription_id}/payments`, { headers })
      const paymentsData = await asaasJson(paymentsRes, 'list-payments-existing')
      const firstPayment = paymentsData.data?.[0]
      const invoiceUrl = firstPayment?.invoiceUrl || firstPayment?.bankSlipUrl
      if (invoiceUrl) return NextResponse.json({ url: invoiceUrl })
    }

    // Busca por externalReference no Asaas antes de criar (anti-duplicata em retry)
    const subSearchRes = await fetch(`${baseUrl}/subscriptions?externalReference=${subExtRef}`, { headers })
    const subSearchData = await asaasJson(subSearchRes, 'search-subscription')
    let subscriptionId: string | undefined = subSearchData.data?.[0]?.id

    if (subscriptionId) {
      // Assinatura já existe no Asaas — salva no banco se não estava
      await service.from('companies').update({
        asaas_subscription_id: subscriptionId,
        plan_type: plan,
        subscription_start_date: today,
      }).eq('id', company.id)
    } else {
      const subRes = await fetch(`${baseUrl}/subscriptions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          customer: customerId,
          billingType: 'UNDEFINED',
          value: planValue,
          nextDueDate: today,
          cycle: 'MONTHLY',
          description: `Zaapply - Plano ${PLAN_LABELS[plan]}`,
          externalReference: subExtRef,
        }),
      })
      const subData = await asaasJson(subRes, 'create-subscription')
      if (!subRes.ok) throw new Error(subData.errors?.[0]?.description || 'Erro ao criar assinatura')

      subscriptionId = subData.id

      await service.from('companies').update({
        asaas_subscription_id: subscriptionId,
        plan_type: plan,
        subscription_start_date: today,
      }).eq('id', company.id)
    }

    // ── 3. Buscar primeiro pagamento para obter URL de fatura ─────────────────
    const paymentsRes = await fetch(`${baseUrl}/subscriptions/${subscriptionId}/payments`, { headers })
    const paymentsData = await asaasJson(paymentsRes, 'list-payments')
    const firstPayment = paymentsData.data?.[0]

    const invoiceUrl = firstPayment?.invoiceUrl || firstPayment?.bankSlipUrl

    if (!invoiceUrl) {
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
