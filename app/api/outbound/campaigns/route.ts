import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { resolveOutboundCaller, isOutboundAuthError } from '@/lib/outbound-auth'

export async function GET() {
  const caller = await resolveOutboundCaller()
  if (isOutboundAuthError(caller)) {
    return NextResponse.json({ success: false, message: caller.message }, { status: caller.status })
  }

  const supabase = createServiceClient()
  const { companyId } = caller

  const [{ data: campaigns, error }, { data: enviadasRows }, { data: abordadosRows }, { data: respondidasRows }] =
    await Promise.all([
      supabase
        .from('outbound_campaigns')
        .select('*, lead:leads!lead_id(contact_name, company_name, whatsapp)')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false }),
      supabase.from('outbound_campaigns').select('id').eq('company_id', companyId).eq('status', 'enviado'),
      supabase.from('outbound_campaigns').select('lead_id').eq('company_id', companyId).gt('tentativas', 0),
      supabase.from('outbound_campaigns').select('id').eq('company_id', companyId).not('respondeu_em', 'is', null).eq('resposta_bot', false),
    ])

  if (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    campaigns: campaigns ?? [],
    stats: {
      totalEnviadas: enviadasRows?.length ?? 0,
      totalAbordados: new Set((abordadosRows ?? []).map((r: any) => r.lead_id)).size,
      totalRespondidas: respondidasRows?.length ?? 0,
    },
  })
}
