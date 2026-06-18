import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const { context, error: authError } = await requireAuth(req)
  if (authError) return authError

  const supabase = createServiceClient()
  const { data } = await supabase
    .from('sdr_configs')
    .select('meta_access_token, meta_ad_account_id, meta_ad_account_name')
    .eq('company_id', context.companyId)
    .maybeSingle()

  return NextResponse.json({
    connected:    !!data?.meta_access_token,
    accountId:    data?.meta_ad_account_id   ?? null,
    accountName:  data?.meta_ad_account_name ?? null,
  })
}

export async function DELETE(req: NextRequest) {
  const { context, error: authError } = await requireAuth(req)
  if (authError) return authError

  const supabase = createServiceClient()
  await supabase
    .from('sdr_configs')
    .update({ meta_access_token: null, meta_ad_account_id: null, meta_ad_account_name: null })
    .eq('company_id', context.companyId)

  return NextResponse.json({ ok: true })
}
