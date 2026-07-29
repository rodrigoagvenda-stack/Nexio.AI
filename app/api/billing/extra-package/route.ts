/**
 * POST /api/billing/extra-package
 *
 * Cria cobrança PIX para pacote extra de tokens.
 * Retorna QR code para pagamento. Ao confirmar (via webhook), o pacote
 * é inserido em extra_packages automaticamente.
 *
 * Body:
 *   tokens   number  : quantidade de tokens do pacote (deve corresponder a um pacote válido)
 * Valor é calculado server-side; nunca aceito do cliente.
 */

// Tabela de preços server-side : nunca confiar no amount do cliente
const TOKEN_PRICE_MAP: Record<number, number> = {
  1_000_000:  97,
  5_000_000: 420,
 10_000_000: 750,
 20_000_000: 1300,
}

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { createServiceClient } from '@/lib/supabase/server'
import { createOrGetCustomer, createPixCharge, getPixQrCode } from '@/lib/asaas/client'

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

/** Calcula o fim do ciclo mensal atual com base na data de início da assinatura. */
function currentCycleEnd(subscriptionStartDate: Date): Date {
  const now = new Date()
  const dayOfMonth = subscriptionStartDate.getDate()

  let end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), dayOfMonth, 23, 59, 59, 999))
  if (end <= now) {
    end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, dayOfMonth, 23, 59, 59, 999))
  }
  return end
}

export async function POST(request: NextRequest) {
  const { context, error: authError } = await requireAuth(request)
  if (authError) return authError

  if (context.role !== 'admin' && context.role !== 'company_admin') {
    return NextResponse.json({ success: false, message: 'Apenas administradores' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { tokens } = body

    const amount = TOKEN_PRICE_MAP[tokens as number]
    if (!amount) {
      return NextResponse.json({ success: false, message: `Pacote inválido. Opções: ${Object.keys(TOKEN_PRICE_MAP).join(', ')} tokens` }, { status: 400 })
    }

    const supabase = createServiceClient()

    const { data: company } = await supabase
      .from('companies')
      .select('id, name, email, asaas_customer_id, asaas_cpf_cnpj, subscription_start_date')
      .eq('id', context.companyId)
      .single()

    if (!company) return NextResponse.json({ success: false, message: 'Empresa não encontrada' }, { status: 404 })

    // Precisa ter assinatura ativa (ou ao menos customer_id) para comprar pacote
    const cpfCnpj = company.asaas_cpf_cnpj
    if (!cpfCnpj) {
      return NextResponse.json({
        success: false,
        message: 'Configure uma assinatura antes de comprar pacotes extras',
      }, { status: 400 })
    }

    // 1. Criar ou recuperar cliente Asaas
    const customer = company.asaas_customer_id
      ? { id: company.asaas_customer_id }
      : await createOrGetCustomer({ name: company.name, email: company.email, cpfCnpj })

    // 2. Criar cobrança PIX
    const charge = await createPixCharge({
      customerId: customer.id,
      value: amount,
      description: `Zaapply : ${(tokens as number).toLocaleString('pt-BR')} tokens extras`,
      dueDate: todayISO(),
    })

    // 3. Buscar QR code
    const qrcode = await getPixQrCode(charge.id)

    // 4. Calcular valid_until = fim do ciclo mensal atual
    const startDate = company.subscription_start_date
      ? new Date(company.subscription_start_date)
      : new Date()  // fallback: ciclo começa hoje
    const validUntil = currentCycleEnd(startDate)

    // 5. Inserir registro pending em extra_package_charges
    const { data: charge_record, error: dbErr } = await supabase
      .from('extra_package_charges')
      .insert({
        tenant_id: context.companyId,
        asaas_payment_id: charge.id,
        tokens_to_grant: tokens,
        amount,
        status: 'pending',
        pix_payload: {
          encodedImage: qrcode.encodedImage,
          payload: qrcode.payload,
          expirationDate: qrcode.expirationDate,
        },
        valid_until: validUntil.toISOString(),
      })
      .select('id')
      .single()

    if (dbErr) throw dbErr

    return NextResponse.json({
      success: true,
      chargeId: charge_record.id,
      asaasPaymentId: charge.id,
      pix: {
        qrcodeImage: qrcode.encodedImage,
        copyPaste: qrcode.payload,
        expiresAt: qrcode.expirationDate,
      },
      validUntil: validUntil.toISOString(),
      tokens,
      amount,
    })
  } catch (err: any) {
    console.error('[billing/extra-package]', err)
    return NextResponse.json({ success: false, message: err.message }, { status: 500 })
  }
}
