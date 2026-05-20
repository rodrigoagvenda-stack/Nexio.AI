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
    .select('step_id')
    .eq('sequence_id', params.id)

  const counts: Record<string, number> = {}
  for (const row of data ?? []) {
    if (row.step_id) counts[row.step_id] = (counts[row.step_id] ?? 0) + 1
  }

  return NextResponse.json({ counts })
}
