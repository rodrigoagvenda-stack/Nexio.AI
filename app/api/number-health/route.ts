// Épico 9 — Painel de saúde do número WhatsApp
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'

export async function GET(req: NextRequest) {
  const { context, error: authError } = await requireAuth(req)
  if (authError) return authError

  const supabase = createServiceClient()

  const { data: numbers, error: numErr } = await supabase
    .from('meta_wa_numbers')
    .select('id, friendly_name, phone_number, status')
    .eq('company_id', context.companyId)
    .eq('status', 'conectado')

  if (numErr) {
    if (numErr.message?.includes('does not exist')) {
      return NextResponse.json({ numbers: [], migration_pending: true })
    }
    return NextResponse.json({ error: numErr.message }, { status: 500 })
  }

  if (!numbers || numbers.length === 0) {
    return NextResponse.json({ numbers: [], metrics: [] })
  }

  const numberIds = numbers.map(n => n.id)

  const { data: metrics } = await supabase
    .from('number_health_metrics')
    .select('*')
    .in('wa_number_id', numberIds)
    .order('measured_at', { ascending: false })

  // For each number, get the latest metric
  const latestMetrics: Record<string, any> = {}
  for (const m of (metrics ?? [])) {
    if (!latestMetrics[m.wa_number_id]) {
      latestMetrics[m.wa_number_id] = m
    }
  }

  // Calculate response rates from conversations (internal calculation)
  const { data: convStats } = await supabase
    .from('conversas_do_whatsapp')
    .select('wa_number_id, created_at')
    .eq('company_id', context.companyId)
    .gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString())
    .not('wa_number_id', 'is', null)

  const volumeByNumber: Record<string, number> = {}
  for (const c of (convStats ?? [])) {
    if (c.wa_number_id) volumeByNumber[c.wa_number_id] = (volumeByNumber[c.wa_number_id] ?? 0) + 1
  }

  const result = numbers.map(n => ({
    ...n,
    metrics: latestMetrics[n.id] ?? null,
    conversations_30d: volumeByNumber[n.id] ?? 0,
  }))

  return NextResponse.json({ numbers: result })
}
