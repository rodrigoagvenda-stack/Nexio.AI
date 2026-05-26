import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const { context, error: authError } = await requireAuth(request)
  if (authError) return authError

  const service = createServiceClient()

  const { data: seq } = await service
    .from('follow_sequences')
    .select('id')
    .eq('id', params.id)
    .eq('company_id', context.companyId)
    .single()

  if (!seq) return NextResponse.json({ counts: {} })

  const { data } = await service
    .from('follow_executions')
    .select('step_id, status')
    .eq('sequence_id', params.id)

  type StepStats = { total: number; sent: number; failed: number; skipped: number; dlq: number }
  const counts: Record<string, StepStats> = {}
  for (const row of data ?? []) {
    if (!row.step_id) continue
    if (!counts[row.step_id]) counts[row.step_id] = { total: 0, sent: 0, failed: 0, skipped: 0, dlq: 0 }
    counts[row.step_id].total++
    const s = row.status as keyof StepStats
    if (s in counts[row.step_id]) counts[row.step_id][s]++
  }

  return NextResponse.json({ counts })
}
