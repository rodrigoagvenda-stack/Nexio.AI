import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getPlatformConfig } from '@/lib/platform-config'
import { TOKEN_MIN_PURCHASE_BRL, tokensForAmount } from '@/lib/billing/plans'

// Preço e tamanho do pacote vêm de lib/billing/plans.ts (R$ 45 = 3M tokens)

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
    const amount = Math.max(TOKEN_MIN_PURCHASE_BRL, Number(body.amount) || TOKEN_MIN_PURCHASE_BRL)
    const tokensToGrant = tokensForAmount(amount)

    const cfg = await getPlatformConfig()
    const apiKey = cfg.asaas_api_key
    const baseUrl = cfg.asaas_base_url || 'https://api.asaas.com/v3'
    if (!apiKey) return NextResponse.json({ error: 'Gateway de pagamentos não configurado' }, { status: 503 })

    const service = createServiceClient()
    const { data: company } = await service
      .from('companies')
      .select('id, name, asaas_customer_id, subscription_expires_at')
      .eq('id', userData.company_id)
      .single()
    if (!company) return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 })
    if (!company.asaas_customer_id) return NextResponse.json({ error: 'Complete o cadastro de pagamento primeiro' }, { status: 400 })

    const headers = { 'Content-Type': 'application/json', 'access_token': apiKey }
    const today = new Date().toISOString().split('T')[0]

    // valid_until = fim do ciclo atual (subscription_expires_at) ou fim do mês
    const validUntil = company.subscription_expires_at
      ? new Date(company.subscription_expires_at)
      : (() => { const d = new Date(); d.setUTCMonth(d.getUTCMonth() + 1, 1); d.setUTCHours(0, 0, 0, 0); return d })()

    // ── 1. Criar cobrança avulsa no Asaas ─────────────────────────────────────
    const payRes = await fetch(`${baseUrl}/payments`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        customer: company.asaas_customer_id,
        billingType: 'UNDEFINED',
        value: amount,
        dueDate: today,
        description: `Zaapli : ${(tokensToGrant / 1_000_000).toFixed(1)}M tokens extras`,
      }),
    })
    const payData = await payRes.json()
    if (!payRes.ok) throw new Error(payData.errors?.[0]?.description || 'Erro ao criar cobrança')

    const asaasPaymentId: string = payData.id

    // ── 2. Pré-registrar em extra_package_charges ─────────────────────────────
    await service.from('extra_package_charges').insert({
      tenant_id: company.id,
      asaas_payment_id: asaasPaymentId,
      tokens_to_grant: tokensToGrant,
      amount,
      status: 'pending',
      valid_until: validUntil.toISOString(),
    })

    const invoiceUrl = payData.invoiceUrl || payData.bankSlipUrl
    if (!invoiceUrl) {
      return NextResponse.json({ message: 'Cobrança criada! Você receberá o link de pagamento por email.' })
    }

    return NextResponse.json({ url: invoiceUrl })
  } catch (err: any) {
    console.error('[asaas/extra-tokens]', err)
    return NextResponse.json({ error: err.message || 'Erro ao processar compra' }, { status: 500 })
  }
}
