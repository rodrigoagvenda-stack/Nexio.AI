import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const { context, error: authError } = await requireAuth(request);
  if (authError) return authError;

  try {
    const service = createServiceClient()

    // Verify the sequence belongs to this company
    const { data: seq } = await service
      .from('follow_sequences')
      .select('id')
      .eq('id', params.id)
      .eq('company_id', context.companyId)
      .single()

    if (!seq) return NextResponse.json({ error: 'Sequência não encontrada' }, { status: 404 })

    // Fetch executions with defensive fallback for missing FK relationships
    let data: any[] = []
    try {
      const { data: rows, error } = await service
        .from('follow_executions')
        .select(`id, disparado_em, status, lead_id, step_id,
          leads (id, nome, telefone),
          follow_steps (id, mensagem, tipo_mensagem, dia_offset, ordem)`)
        .eq('sequence_id', params.id)
        .order('disparado_em', { ascending: false })
        .limit(100)
      if (!error) data = rows ?? []
      else {
        // Fallback: fetch without joins if FK is not declared
        const { data: plain } = await service
          .from('follow_executions')
          .select('id, disparado_em, status, lead_id, step_id')
          .eq('sequence_id', params.id)
          .order('disparado_em', { ascending: false })
          .limit(100)
        data = plain ?? []
      }
    } catch { data = [] }

    const logs = data.map((row: any) => ({
      id: String(row.id),
      lead: row.leads?.nome ?? row.leads?.telefone ?? `Lead ${row.lead_id ?? '—'}`,
      telefone: row.leads?.telefone ?? null,
      step: row.follow_steps
        ? `${row.follow_steps.tipo_mensagem ?? 'Mensagem'} — Dia ${row.follow_steps.dia_offset ?? 0}`
        : `Passo ${row.step_id ?? '—'}`,
      status: (row.status ?? 'sent') as 'sent' | 'failed' | 'skipped',
      ts: row.disparado_em ?? null,
    }))

    return NextResponse.json({ logs })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
