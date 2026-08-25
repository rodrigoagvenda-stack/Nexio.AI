import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { resolveOutboundCaller, isOutboundAuthError } from '@/lib/outbound-auth'

export async function GET() {
  const caller = await resolveOutboundCaller()
  if (isOutboundAuthError(caller)) {
    return NextResponse.json({ success: false, message: caller.message }, { status: caller.status })
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('follow_logs')
    .select('momento')
    .eq('company_id', caller.companyId)

  if (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 })
  }

  const counts: Record<string, number> = {}
  for (const row of data ?? []) {
    if (row.momento) counts[row.momento] = (counts[row.momento] ?? 0) + 1
  }

  return NextResponse.json({ success: true, counts })
}
