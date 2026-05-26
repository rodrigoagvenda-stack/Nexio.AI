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

  if (!seq) return NextResponse.json({ conversions: [], total: 0, rate: 0 })

  // All goal steps in this sequence
  const { data: goalSteps } = await service
    .from('follow_steps')
    .select('id, condicao, ordem')
    .eq('sequence_id', params.id)
    .eq('tipo_mensagem', 'goal')

  if (!goalSteps?.length) return NextResponse.json({ conversions: [], total: 0, rate: 0 })

  const goalStepIds = goalSteps.map((s) => s.id)

  // Executions that hit a goal step (status = sent)
  const { data: goalExecs } = await service
    .from('follow_executions')
    .select('lead_id, step_id, disparado_em')
    .eq('sequence_id', params.id)
    .in('step_id', goalStepIds)
    .eq('status', 'sent')
    .order('disparado_em', { ascending: false })

  // Total unique leads that entered this sequence
  const { count: totalEntered } = await service
    .from('follow_executions')
    .select('lead_id', { count: 'exact', head: true })
    .eq('sequence_id', params.id)
    .eq('status', 'sent')

  // Enrich with lead info
  const leadIds = [...new Set((goalExecs ?? []).map((e) => e.lead_id).filter(Boolean))]
  const { data: leads } = leadIds.length
    ? await service
        .from('leads')
        .select('id, contact_name, whatsapp, status')
        .in('id', leadIds)
    : { data: [] }

  const leadMap = Object.fromEntries((leads ?? []).map((l) => [l.id, l]))
  const stepMap = Object.fromEntries(goalSteps.map((s) => [s.id, s]))

  const conversions = (goalExecs ?? []).map((exec) => ({
    lead_id: exec.lead_id,
    lead_name: leadMap[exec.lead_id]?.contact_name ?? '—',
    lead_status: leadMap[exec.lead_id]?.status ?? '—',
    whatsapp: leadMap[exec.lead_id]?.whatsapp ?? null,
    goal_label: stepMap[exec.step_id]?.condicao || 'Convertido',
    goal_ordem: stepMap[exec.step_id]?.ordem ?? 0,
    converted_at: exec.disparado_em,
  }))

  const uniqueConverted = new Set((goalExecs ?? []).map((e) => e.lead_id)).size
  const rate = totalEntered ? Math.round((uniqueConverted / totalEntered) * 1000) / 10 : 0

  return NextResponse.json({ conversions, total: uniqueConverted, rate })
}
