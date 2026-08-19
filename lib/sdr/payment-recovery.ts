// Peça D do plano "máquina de vendas completa": rede de segurança automática
// pra cobrança que ficou parada -- funciona pra toda empresa que gera cobrança
// (manual ou via canvas), sem precisar montar fluxo nenhum. O nó de canvas
// aguardar_pagamento (lib/sdr/follow.ts) é o caminho opcional/customizado;
// este cron é o caminho padrão que "só funciona".
import { createServiceClient } from '@/lib/supabase/server'
import { normalizePhone } from './uazapi'
import { sendRichStepUnified } from './rich-sender'

type Supabase = ReturnType<typeof createServiceClient>

const STALE_HOURS = 3

interface StaleCharge {
  id: string
  company_id: number
  lead_id: number
  amount: number
  billing_type: string | null
  payment_url: string | null
  invoice_url: string | null
  pix_payload: any
  last_recovery_nudge_at: string | null
}

async function resolvePhone(companyId: number, leadId: number, supabase: Supabase): Promise<string | null> {
  const { data } = await supabase.from('leads').select('whatsapp').eq('id', leadId).eq('company_id', companyId).maybeSingle()
  return data?.whatsapp ? normalizePhone(data.whatsapp) : null
}

function buildNudgeMessage(charge: StaleCharge): string {
  const valor = `R$ ${Number(charge.amount).toFixed(2).replace('.', ',')}`
  const lines = [`Oi! Vi que sua cobrança de ${valor} ainda tá pendente.`]
  if (charge.billing_type === 'PIX' && charge.pix_payload?.payload) {
    lines.push('', 'Aqui está o código PIX de novo:', `\`${charge.pix_payload.payload}\``)
  } else {
    const url = charge.payment_url || charge.invoice_url
    if (url) lines.push('', `Link de pagamento: ${url}`)
  }
  lines.push('', 'Precisa de ajuda com o pagamento? É só me chamar aqui 🙂')
  return lines.join('\n')
}

export async function runPaymentRecovery(): Promise<{ processed: number; sent: number; errors: string[] }> {
  const supabase = createServiceClient()
  const errors: string[] = []
  let sent = 0

  const staleThreshold = new Date(Date.now() - STALE_HOURS * 3_600_000).toISOString()

  // Uma cutucada por cobrança na vida toda (last_recovery_nudge_at IS NULL) --
  // simples e sem risco de reenviar em loop; suficiente pro objetivo de
  // "lembrar uma vez", sem precisar de coluna extra de contador.
  const { data: charges } = await supabase
    .from('lead_charges')
    .select('id, company_id, lead_id, amount, billing_type, payment_url, invoice_url, pix_payload, last_recovery_nudge_at')
    .eq('status', 'pending')
    .lte('created_at', staleThreshold)
    .is('last_recovery_nudge_at', null)
    .limit(200)

  const list = (charges ?? []) as StaleCharge[]

  for (const charge of list) {
    try {
      const phone = await resolvePhone(charge.company_id, charge.lead_id, supabase)
      if (!phone) continue

      await sendRichStepUnified(charge.company_id, phone, 'text', buildNudgeMessage(charge))
      await supabase.from('lead_charges').update({ last_recovery_nudge_at: new Date().toISOString() }).eq('id', charge.id)
      sent++
    } catch (err: any) {
      errors.push(`charge=${charge.id}: ${err.message}`)
    }
  }

  return { processed: list.length, sent, errors }
}
