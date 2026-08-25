import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { resolveOutboundCaller, isOutboundAuthError } from '@/lib/outbound-auth'

export async function GET(_request: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params

  const caller = await resolveOutboundCaller()
  if (isOutboundAuthError(caller)) {
    return NextResponse.json({ success: false, message: caller.message }, { status: caller.status })
  }

  const supabase = createServiceClient()

  // Confirma que a campanha é da empresa do usuário antes de expor os erros dela
  const { data: campaign } = await supabase
    .from('outbound_campaigns')
    .select('id')
    .eq('id', id)
    .eq('company_id', caller.companyId)
    .maybeSingle()
  if (!campaign) {
    return NextResponse.json({ success: false, message: 'Campanha não encontrada' }, { status: 404 })
  }

  const { data: errors, error } = await supabase
    .from('outbound_campaigns_errors')
    .select('*')
    .eq('campaign_id', id)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, errors: errors ?? [] })
}
