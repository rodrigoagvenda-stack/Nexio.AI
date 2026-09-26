/**
 * SDR v3: Gerar_cobranca (Asaas) chamada pelo código. Mesmo comportamento da ferramenta atual:
 * recorrência é decisão da empresa, nunca da IA; assinatura é sempre cartão.
 */
import type { createServiceClient } from '@/lib/supabase/server'
import { createCharge, createSubscription, findOrCreateCustomer, getPixQrCode, getSubscriptionFirstPaymentUrl, type BillingType } from '@/lib/asaas/company-client'

type Supabase = ReturnType<typeof createServiceClient>

export type ResultadoCobranca = { ok: true; texto: string; valor: number } | { ok: false; detalhe: string }

export async function gerarCobranca(
  p: { companyId: number; leadId: number; leadName: string; leadPhone: string; cpfCnpj: string; valor: number; descricao: string; recorrente: boolean },
  supabase: Supabase,
): Promise<ResultadoCobranca> {
  const cpfCnpj = p.cpfCnpj.replace(/\D/g, '')
  if (!p.valor || p.valor <= 0 || !p.descricao) return { ok: false, detalhe: 'valor ou descrição inválidos' }
  if (cpfCnpj.length !== 11 && cpfCnpj.length !== 14) return { ok: false, detalhe: 'CPF ou CNPJ inválido' }
  const billingType: BillingType = p.recorrente ? 'CREDIT_CARD' : 'UNDEFINED'
  try {
    const customer = await findOrCreateCustomer(p.companyId, { name: p.leadName || 'Lead', phone: p.leadPhone || undefined, cpfCnpj, externalReference: `lead_${p.leadId}` })
    let externalId: string
    let paymentUrl: string | undefined
    let bankSlipUrl: string | undefined
    let dueDate: string
    if (p.recorrente) {
      const sub = await createSubscription(p.companyId, {
        customerId: customer.id,
        value: p.valor,
        billingType,
        description: p.descricao,
        cycle: 'MONTHLY',
        externalReference: `zaapply_v3_sub_${p.leadId}_${Date.now()}`,
      })
      externalId = sub.id
      dueDate = sub.nextDueDate
      const first = await getSubscriptionFirstPaymentUrl(p.companyId, sub.id)
      paymentUrl = first.invoiceUrl
      bankSlipUrl = first.bankSlipUrl
    } else {
      dueDate = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10)
      const pay = await createCharge(p.companyId, {
        customerId: customer.id,
        value: p.valor,
        dueDate,
        billingType,
        description: p.descricao,
        externalReference: `zaapply_v3_${p.leadId}_${Date.now()}`,
      })
      externalId = pay.id
      paymentUrl = pay.invoiceUrl
      bankSlipUrl = pay.bankSlipUrl
    }
    await supabase.from('lead_charges').insert({
      company_id: p.companyId,
      lead_id: p.leadId,
      platform: 'asaas',
      external_id: externalId,
      amount: p.valor,
      description: p.descricao,
      billing_type: billingType,
      due_date: dueDate,
      status: 'pending',
      payment_url: paymentUrl,
      invoice_url: bankSlipUrl || paymentUrl,
      pix_payload: null,
    })
    const venc = new Date(dueDate + 'T12:00:00').toLocaleDateString('pt-BR')
    const valorTxt = `R$ ${p.valor.toFixed(2).replace('.', ',')}`
    return { ok: true, valor: p.valor, texto: `Aqui está o pagamento${p.recorrente ? ' (assinatura mensal)' : ''}: ${valorTxt}, vencimento ${venc}.\n\n${paymentUrl ?? ''}`.trim() }
  } catch (err: any) {
    return { ok: false, detalhe: err?.message ?? 'erro ao gerar cobrança' }
  }
}
