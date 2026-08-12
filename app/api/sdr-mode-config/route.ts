import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'

export async function GET(req: NextRequest) {
  const { context, error: authError } = await requireAuth(req)
  if (authError) return authError

  const waNumberId = new URL(req.url).searchParams.get('wa_number_id')

  const supabase = createServiceClient()
  let query = supabase
    .from('sdr_mode_config')
    .select('*')
    .eq('company_id', context.companyId)

  if (waNumberId) query = query.eq('wa_number_id', waNumberId)

  const { data, error } = await query

  if (error) {
    if (error.message?.includes('does not exist')) return NextResponse.json({ data: [], migration_pending: true })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ data })
}

export async function PUT(req: NextRequest) {
  const { context, error: authError } = await requireAuth(req)
  if (authError) return authError

  const body = await req.json()
  const { wa_number_id, mode, briefing_fields, qualification_rules, out_of_hours_message } = body

  if (!wa_number_id) return NextResponse.json({ error: 'wa_number_id é obrigatório' }, { status: 400 })
  if (mode && !['completo', 'recepcao'].includes(mode)) {
    return NextResponse.json({ error: 'mode deve ser completo ou recepcao' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('sdr_mode_config')
    .upsert(
      {
        company_id: context.companyId,
        wa_number_id,
        mode: mode ?? 'completo',
        briefing_fields: briefing_fields ?? null,
        qualification_rules: qualification_rules ?? null,
        out_of_hours_message: out_of_hours_message ?? null,
      },
      { onConflict: 'company_id,wa_number_id' }
    )
    .select()
    .single()

  if (error) {
    if (error.message?.includes('does not exist')) return NextResponse.json({ error: 'Migration pendente', migration_pending: true }, { status: 503 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ data })
}
