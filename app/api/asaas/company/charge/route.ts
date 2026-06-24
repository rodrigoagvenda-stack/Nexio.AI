/**
 * POST /api/asaas/company/charge
 * Generates a payment charge for a lead using the company's own Asaas credentials.
 * Creates the Asaas customer if not found, saves the charge to lead_charges,
 * optionally sends the payment link via WhatsApp to the lead.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { createServiceClient } from '@/lib/supabase/server'
import { findOrCreateCustomer, createCharge, getPixQrCode, type BillingType } from '@/lib/asaas/company-client'

export async function POST(req: NextRequest) {
  const { context, error: authError } = await requireAuth(req)
  if (authError) return authError

  const body = await req.json().catch(() => null)
  const { leadId, value, dueDate, billingType, description, sendWhatsapp } = body ?? {}

  if (!leadId || !value || !dueDate || !billingType) {
    return NextResponse.json({ error: 'leadId, value, dueDate e billingType são obrigatórios' }, { status: 400 })
  }

  const validBillingTypes: BillingType[] = ['BOLETO', 'PIX', 'CREDIT_CARD', 'UNDEFINED']
  if (!validBillingTypes.includes(billingType)) {
    return NextResponse.json({ error: 'billingType inválido' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Fetch lead data
  const { data: lead, error: leadErr } = await supabase
    .from('leads')
    .select('id, company_name, contact_name, email, whatsapp, company_id')
    .eq('id', leadId)
    .eq('company_id', context.companyId)
    .single()

  if (leadErr || !lead) {
    return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 })
  }

  try {
    // Find or create Asaas customer for this lead
    const customer = await findOrCreateCustomer(context.companyId, {
      name: lead.contact_name || lead.company_name,
      email: lead.email || undefined,
      phone: lead.whatsapp || undefined,
      externalReference: `lead_${lead.id}`,
    })

    // Create the charge in Asaas
    const payment = await createCharge(context.companyId, {
      customerId: customer.id,
      value: Number(value),
      dueDate,
      billingType: billingType as BillingType,
      description: description || `Cobrança - ${lead.company_name}`,
      externalReference: `zaapply_lead_${lead.id}_${Date.now()}`,
    })

    // Get PIX QR code if billing type is PIX
    let pixPayload = null
    if (billingType === 'PIX') {
      try {
        const qr = await getPixQrCode(context.companyId, payment.id)
        pixPayload = qr
      } catch (e) {
        console.warn('[company/charge] failed to get PIX QR', e)
      }
    }

    // Save to lead_charges
    const { data: charge, error: chargeErr } = await supabase
      .from('lead_charges')
      .insert({
        company_id: context.companyId,
        lead_id: lead.id,
        platform: 'asaas',
        external_id: payment.id,
        amount: Number(value),
        description: description || `Cobrança - ${lead.company_name}`,
        billing_type: billingType,
        due_date: dueDate,
        status: 'pending',
        payment_url: payment.invoiceUrl,
        invoice_url: payment.bankSlipUrl || payment.invoiceUrl,
        pix_payload: pixPayload,
      })
      .select()
      .single()

    if (chargeErr) {
      console.error('[company/charge] DB insert error', chargeErr.message)
    }

    // Send via WhatsApp if requested and lead has a phone
    if (sendWhatsapp && lead.whatsapp) {
      try {
        const paymentUrl = billingType === 'PIX'
          ? (pixPayload?.payload ?? payment.invoiceUrl ?? '')
          : (payment.invoiceUrl ?? payment.bankSlipUrl ?? '')

        const msgLines: string[] = [
          `Olá${lead.contact_name ? ` ${lead.contact_name}` : ''}! Segue sua cobrança:`,
          '',
          `💰 Valor: R$ ${Number(value).toFixed(2).replace('.', ',')}`,
          `📅 Vencimento: ${new Date(dueDate + 'T12:00:00').toLocaleDateString('pt-BR')}`,
        ]

        if (description) msgLines.push(`📋 ${description}`)

        if (billingType === 'PIX' && pixPayload?.payload) {
          msgLines.push('', `📲 Código PIX:`, `\`${pixPayload.payload}\``)
        } else if (paymentUrl) {
          msgLines.push('', `🔗 Link de pagamento:`, paymentUrl)
        }

        await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? ''}/api/whatsapp/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId: context.companyId,
            to: lead.whatsapp,
            type: 'text',
            text: msgLines.join('\n'),
          }),
        })
      } catch (e) {
        console.warn('[company/charge] WhatsApp send failed', e)
      }
    }

    return NextResponse.json({
      success: true,
      charge: charge ?? { id: null },
      payment: {
        id: payment.id,
        status: payment.status,
        invoiceUrl: payment.invoiceUrl,
        bankSlipUrl: payment.bankSlipUrl,
        pixPayload,
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro ao gerar cobrança'
    console.error('[company/charge]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
