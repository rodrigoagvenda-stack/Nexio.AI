import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { resolveOutboundCaller, isOutboundAuthError } from '@/lib/outbound-auth'

export async function GET() {
  const caller = await resolveOutboundCaller()
  if (isOutboundAuthError(caller)) {
    return NextResponse.json({ success: false, message: caller.message }, { status: caller.status })
  }

  const supabase = createServiceClient()

  // Achado ao vivo (Rodrigo, 2026-09-09, Grupo Venda) : esse painel lia de
  // "follow_logs", o pipeline legado (lib/sdr/follow-antnoshow.ts). O
  // anti-noshow de verdade roda pelo canvas hoje (follow_sequences com
  // tipo='anti_noshow' + follow_executions) — achado documentado desde
  // 2026-09-04 ("follow-up/remarketing/anti-noshow são exclusivos do canvas
  // agora"). A Grupo Venda tinha 14 disparos reais ali (sequência "Call de
  // Fechamento") e zero em follow_logs : o painel mostrava 0 disparos com o
  // sistema funcionando normalmente, só olhando pra tabela errada.
  const { data: sequences, error: seqError } = await supabase
    .from('follow_sequences')
    .select('id')
    .eq('company_id', caller.companyId)
    .eq('tipo', 'anti_noshow')

  if (seqError) {
    return NextResponse.json({ success: false, message: seqError.message }, { status: 500 })
  }

  const sequenceIds = (sequences ?? []).map((s) => s.id)
  if (!sequenceIds.length) {
    return NextResponse.json({ success: true, counts: {} })
  }

  const { data: steps, error: stepsError } = await supabase
    .from('follow_steps')
    .select('id, dia_offset')
    .in('sequence_id', sequenceIds)

  if (stepsError) {
    return NextResponse.json({ success: false, message: stepsError.message }, { status: 500 })
  }

  // dia_offset é em minutos relativos à call (negativo = antes, positivo =
  // depois) : classifica pelo tamanho do offset, não pela ordem do step, pra
  // não depender de a sequência ter exatamente 4 nós numa ordem fixa.
  const stepLabel = new Map<string, string>()
  for (const step of steps ?? []) {
    const offset = step.dia_offset ?? 0
    const label =
      offset <= -720 ? '24h_antes' :
      offset <= -60  ? '2h_antes' :
      offset < 0     ? '15min_antes' :
      '5min_apos'
    stepLabel.set(step.id, label)
  }

  const { data: executions, error: execError } = await supabase
    .from('follow_executions')
    .select('step_id')
    .in('sequence_id', sequenceIds)
    .eq('status', 'sent')

  if (execError) {
    return NextResponse.json({ success: false, message: execError.message }, { status: 500 })
  }

  const counts: Record<string, number> = {}
  for (const row of executions ?? []) {
    const label = stepLabel.get(row.step_id)
    if (label) counts[label] = (counts[label] ?? 0) + 1
  }

  return NextResponse.json({ success: true, counts })
}
