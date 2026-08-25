import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { resolveOutboundCaller, isOutboundAuthError } from '@/lib/outbound-auth'

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
