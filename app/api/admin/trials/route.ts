import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/require-auth'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { error } = await requireAdmin(request)
  if (error) return error

  const supabase = createServiceClient()

  const { data, error: dbError } = await supabase
    .from('companies')
    .select('id, name, email, created_at, trial_ends_at, plan_type, is_active')
    .eq('plan_type', 'trial')
    .eq('is_shadow_company', false)
    .order('created_at', { ascending: false })

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  return NextResponse.json({ trials: data ?? [] })
}
