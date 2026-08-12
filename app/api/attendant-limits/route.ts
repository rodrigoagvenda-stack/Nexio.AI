import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'

export async function GET(req: NextRequest) {
  const { context, error: authError } = await requireAuth(req)
  if (authError) return authError

  const supabase = createServiceClient()

  // Join attendants to get limits for this company
  const { data, error } = await supabase
    .from('attendant_limits')
    .select('attendant_id, max_concurrent_conversations')
    .in(
      'attendant_id',
      (
        await supabase
          .from('attendants')
          .select('id')
          .eq('company_id', context.companyId)
      ).data?.map(a => a.id) ?? []
    )

  if (error) {
    if (error.message?.includes('does not exist')) return NextResponse.json({ data: [], migration_pending: true })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ data })
}

export async function PUT(req: NextRequest) {
  const { context, error: authError } = await requireAuth(req)
  if (authError) return authError

  const { attendant_id, max_concurrent_conversations } = await req.json()

  if (!attendant_id) return NextResponse.json({ error: 'attendant_id é obrigatório' }, { status: 400 })

  const supabase = createServiceClient()

  // Verify attendant belongs to this company
  const { data: att } = await supabase
    .from('attendants')
    .select('id')
    .eq('id', attendant_id)
    .eq('company_id', context.companyId)
    .maybeSingle()

  if (!att) return NextResponse.json({ error: 'Atendente não encontrado' }, { status: 404 })

  const { data, error } = await supabase
    .from('attendant_limits')
    .upsert(
      {
        attendant_id,
        max_concurrent_conversations: Math.max(1, Math.min(100, parseInt(String(max_concurrent_conversations ?? 15), 10))),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'attendant_id' }
    )
    .select()
    .single()

  if (error) {
    if (error.message?.includes('does not exist')) return NextResponse.json({ error: 'Migration pendente', migration_pending: true }, { status: 503 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ data })
}
