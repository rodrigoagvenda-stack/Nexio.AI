import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'

export async function GET(req: NextRequest) {
  const { context, error: authError } = await requireAuth(req)
  if (authError) return authError

  const url = new URL(req.url)
  const waNumberId = url.searchParams.get('wa_number_id')

  const supabase = createServiceClient()
  let query = supabase
    .from('business_hours')
    .select('*')
    .eq('company_id', context.companyId)
    .order('day_of_week')

  if (waNumberId) query = query.eq('wa_number_id', waNumberId)
  else query = query.is('wa_number_id', null)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function PUT(req: NextRequest) {
  const { context, error: authError } = await requireAuth(req)
  if (authError) return authError

  const body = await req.json()
  const { hours, wa_number_id } = body // hours: [{day_of_week, open_time, close_time, closed}]

  if (!Array.isArray(hours) || hours.length === 0) {
    return NextResponse.json({ error: 'hours array obrigatório' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Upsert all 7 days atomically
  const rows = hours.map((h: { day_of_week: number; open_time: string; close_time: string; closed: boolean }) => ({
    company_id: context.companyId,
    wa_number_id: wa_number_id ?? null,
    day_of_week: h.day_of_week,
    open_time: h.closed ? null : (h.open_time || '08:00'),
    close_time: h.closed ? null : (h.close_time || '18:00'),
    closed: !!h.closed,
  }))

  const { error } = await supabase
    .from('business_hours')
    .upsert(rows, { onConflict: 'company_id,wa_number_id,day_of_week', ignoreDuplicates: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
