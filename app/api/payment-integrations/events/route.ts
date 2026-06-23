import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const { context, error: authError } = await requireAuth(req)
  if (authError) return authError

  const platform = req.nextUrl.searchParams.get('platform') ?? 'asaas'
  const supabase = createServiceClient()

  const { data } = await supabase
    .from('payment_integrations')
    .select('config, active')
    .eq('company_id', context.companyId)
    .eq('platform', platform)
    .maybeSingle()

  const events: any[] = Array.isArray(data?.config?.recent_events) ? data.config.recent_events : []
  return NextResponse.json({ events, active: data?.active ?? false })
}
