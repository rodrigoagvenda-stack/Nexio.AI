import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { resolveOutboundCaller, isOutboundAuthError } from '@/lib/outbound-auth'

const VALID_STATUSES = ['agendada', 'confirmada', 'realizada', 'no_show', 'cancelada']

export async function PATCH(request: NextRequest) {
  const caller = await resolveOutboundCaller()
  if (isOutboundAuthError(caller)) {
    return NextResponse.json({ success: false, message: caller.message }, { status: caller.status })
  }

  const { leadId, call_status } = await request.json()
  if (!leadId || !VALID_STATUSES.includes(call_status)) {
    return NextResponse.json({ success: false, message: 'Dados inválidos' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('leads')
    .update({ call_status })
    .eq('id', leadId)
    .eq('company_id', caller.companyId)

  if (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

export async function GET() {
  const caller = await resolveOutboundCaller()
  if (isOutboundAuthError(caller)) {
    return NextResponse.json({ success: false, message: caller.message }, { status: caller.status })
  }

  const supabase = createServiceClient()
  const { data: meetings, error } = await supabase
    .from('leads')
    .select('id, contact_name, company_name, call_status, meet_url, call_agendada_para')
    .eq('company_id', caller.companyId)
    .not('call_status', 'is', null)
    .order('call_agendada_para', { ascending: true })

  if (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, meetings: meetings ?? [] })
}
