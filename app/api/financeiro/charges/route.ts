import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const { context, error: authError } = await requireAuth(req)
  if (authError) return authError

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') // paid | pending | overdue | all
  const period = searchParams.get('period') // 7 | 30 | 90 | all
  const platform = searchParams.get('platform') // asaas | mercadopago | kiwify

  const supabase = createServiceClient()

  let query = supabase
    .from('lead_charges')
    .select(`
      id,
      platform,
      external_id,
      amount,
      description,
      billing_type,
      due_date,
      status,
      payment_url,
      invoice_url,
      created_at,
      lead_id,
      leads ( id, company_name, contact_name, whatsapp )
    `)
    .eq('company_id', context.companyId)
    .order('created_at', { ascending: false })

  if (status && status !== 'all') {
    query = query.eq('status', status)
  }

  if (platform && platform !== 'all') {
    query = query.eq('platform', platform)
  }

  if (period && period !== 'all') {
    const days = parseInt(period)
    if (!isNaN(days)) {
      const from = new Date()
      from.setDate(from.getDate() - days)
      query = query.gte('created_at', from.toISOString())
    }
  }

  const { data: charges, error } = await query.limit(200)

  if (error) {
    console.error('[financeiro/charges:GET]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Aggregates
  const allForStats = charges ?? []
  const totalReceived = allForStats
    .filter(c => c.status === 'paid')
    .reduce((s, c) => s + (c.amount ?? 0), 0)
  const totalPending = allForStats
    .filter(c => c.status === 'pending')
    .reduce((s, c) => s + (c.amount ?? 0), 0)
  const totalOverdue = allForStats
    .filter(c => c.status === 'overdue')
    .reduce((s, c) => s + (c.amount ?? 0), 0)

  return NextResponse.json({
    charges: charges ?? [],
    stats: {
      received: totalReceived,
      pending: totalPending,
      overdue: totalOverdue,
      total: allForStats.length,
    },
  })
}
