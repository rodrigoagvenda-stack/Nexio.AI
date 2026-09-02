import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const service = createServiceClient()
    const { data: adminUser } = await service.from('admin_users').select('id').eq('auth_user_id', user.id).eq('is_active', true).single()
    if (!adminUser) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

    const startOfMonth = new Date()
    startOfMonth.setUTCDate(1)
    startOfMonth.setUTCHours(0, 0, 0, 0)

    // Total global this month
    const { data: monthly } = await service
      .from('usage_logs')
      .select('total_tokens, cost_usd')
      .gte('created_at', startOfMonth.toISOString())

    const totalTokens = monthly?.reduce((s, r) => s + (r.total_tokens ?? 0), 0) ?? 0
    const totalCostUsd = monthly?.reduce((s, r) => s + Number(r.cost_usd ?? 0), 0) ?? 0

    // Per-company breakdown this month
    const { data: perCompany } = await service
      .from('usage_logs')
      .select('tenant_id, total_tokens, cost_usd')
      .gte('created_at', startOfMonth.toISOString())

    const byCompany: Record<number, { tokens: number; cost: number }> = {}
    for (const row of perCompany ?? []) {
      if (!byCompany[row.tenant_id]) byCompany[row.tenant_id] = { tokens: 0, cost: 0 }
      byCompany[row.tenant_id].tokens += row.total_tokens ?? 0
      byCompany[row.tenant_id].cost += Number(row.cost_usd ?? 0)
    }

    // All-time totals
    const { data: allTime } = await service.from('usage_logs').select('total_tokens, cost_usd')
    const allTimeTokens = allTime?.reduce((s, r) => s + (r.total_tokens ?? 0), 0) ?? 0
    const allTimeCostUsd = allTime?.reduce((s, r) => s + Number(r.cost_usd ?? 0), 0) ?? 0

    // Active companies with plan limits
    const { data: companies } = await service
      .from('companies')
      .select('id, name, plan_type, tokens_limit, tokens_used')
      .eq('is_active', true)
      .eq('is_shadow_company', false)

    return NextResponse.json({
      monthly: { tokens: totalTokens, cost_usd: totalCostUsd },
      all_time: { tokens: allTimeTokens, cost_usd: allTimeCostUsd },
      by_company: byCompany,
      companies: companies ?? [],
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
