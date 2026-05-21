import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { context, error: authError } = await requireAuth(request)
  if (authError) return authError

  try {
    const service = createServiceClient()
    const { data, error } = await service
      .from('leads')
      .select('id, contact_name, whatsapp, status, call_agendada_para, call_status')
      .eq('company_id', context.companyId)
      .not('call_agendada_para', 'is', null)
      .neq('call_status', 'realizada')
      .order('call_agendada_para', { ascending: true })

    if (error) throw error
    return NextResponse.json({ calls: data ?? [] })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
