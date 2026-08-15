import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'

export async function GET(req: NextRequest) {
  const { context, error: authError } = await requireAuth(req)
  if (authError) return authError

  const url = new URL(req.url)
  const days = parseInt(url.searchParams.get('days') ?? '30', 10)
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  const supabase = createServiceClient()

  // Conversations in the period
  const { data: convs, error: convErr } = await supabase
    .from('conversas_do_whatsapp')
    .select('id, created_at:criado_em, current_status, kanban_stage, current_attendant_id')
    .eq('company_id', context.companyId)
    .gte('criado_em', since)

  if (convErr) {
    if (convErr.message?.includes('does not exist')) {
      return NextResponse.json({ migration_pending: true })
    }
    return NextResponse.json({ error: convErr.message }, { status: 500 })
  }

  // Conversion values (deals closed)
  const { data: deals } = await supabase
    .from('conversion_values')
    .select('conversation_id, value_cents, recorded_at, attendant_id')
    .eq('company_id', context.companyId)
    .gte('recorded_at', since)

  // Attendants
  const { data: attendants } = await supabase
    .from('attendants')
    .select('id, name, email, role')
    .eq('company_id', context.companyId)
    .eq('active', true)

  // Assignments in period (for response time approximation)
  const { data: assignments } = await supabase
    .from('conversation_assignments')
    .select('conversation_id, attendant_id, assigned_at, released_at')
    .eq('company_id', context.companyId)
    .gte('assigned_at', since)

  // ── Compute funnel ──────────────────────────────────────────────────────────
  const total = convs?.length ?? 0
  const stages = ['novo', 'qualificacao', 'fila', 'em_atendimento', 'negociacao', 'fechado'] as const
  const funnelCounts: Record<string, number> = {}
  for (const stage of stages) funnelCounts[stage] = 0
  for (const c of convs ?? []) {
    const stage = c.kanban_stage ?? 'novo'
    funnelCounts[stage] = (funnelCounts[stage] ?? 0) + 1
  }

  // ── Per-attendant stats ─────────────────────────────────────────────────────
  const convsByAttendant: Record<string, number> = {}
  for (const c of convs ?? []) {
    if (c.current_attendant_id) {
      convsByAttendant[c.current_attendant_id] = (convsByAttendant[c.current_attendant_id] ?? 0) + 1
    }
  }

  const dealsByAttendant: Record<string, { count: number; total_cents: number }> = {}
  for (const d of deals ?? []) {
    if (d.attendant_id) {
      if (!dealsByAttendant[d.attendant_id]) dealsByAttendant[d.attendant_id] = { count: 0, total_cents: 0 }
      dealsByAttendant[d.attendant_id].count++
      dealsByAttendant[d.attendant_id].total_cents += d.value_cents ?? 0
    }
  }

  const totalRevenue = (deals ?? []).reduce((acc, d) => acc + (d.value_cents ?? 0), 0)
  const closedCount = funnelCounts['fechado'] ?? 0
  const conversionRate = total > 0 ? ((closedCount / total) * 100).toFixed(1) : '0.0'

  // ── Average time in queue (from assignments) ────────────────────────────────
  const queueTimes: number[] = []
  for (const a of assignments ?? []) {
    if (a.assigned_at && a.released_at) {
      const ms = new Date(a.released_at).getTime() - new Date(a.assigned_at).getTime()
      if (ms > 0) queueTimes.push(ms)
    }
  }
  const avgQueueMs = queueTimes.length > 0
    ? queueTimes.reduce((a, b) => a + b, 0) / queueTimes.length
    : null
  const avgQueueMin = avgQueueMs !== null ? Math.round(avgQueueMs / 60000) : null

  // ── Day-by-day volume (heatmap data) ───────────────────────────────────────
  const dayMap: Record<string, number> = {}
  for (const c of convs ?? []) {
    const day = c.created_at?.slice(0, 10)
    if (day) dayMap[day] = (dayMap[day] ?? 0) + 1
  }
  const heatmap = Object.entries(dayMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }))

  // ── Attendant leaderboard ──────────────────────────────────────────────────
  const leaderboard = (attendants ?? []).map(att => ({
    id: att.id,
    name: att.name,
    email: att.email,
    role: att.role,
    active_conversations: convsByAttendant[att.id] ?? 0,
    closed_deals: dealsByAttendant[att.id]?.count ?? 0,
    revenue_cents: dealsByAttendant[att.id]?.total_cents ?? 0,
  })).sort((a, b) => b.revenue_cents - a.revenue_cents)

  return NextResponse.json({
    period_days: days,
    summary: {
      total_conversations: total,
      closed_deals: closedCount,
      total_revenue_cents: totalRevenue,
      conversion_rate: conversionRate,
      avg_queue_min: avgQueueMin,
    },
    funnel: stages.map(s => ({ stage: s, count: funnelCounts[s] ?? 0 })),
    heatmap,
    leaderboard,
  })
}
