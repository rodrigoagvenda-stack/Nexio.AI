import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'

export async function GET(req: NextRequest) {
  const { context, error: authError } = await requireAuth(req)
  if (authError) return authError

  const service = createServiceClient()
  const { data: trials } = await service
    .from('saas_trials')
    .select('id, nome, email, whatsapp, status, criado_em, trial_days')
    .eq('company_id', context.companyId)
    .eq('status', 'ativo')
    .order('criado_em', { ascending: false })
    .limit(100)

  return NextResponse.json({ trials: trials ?? [] })
}
