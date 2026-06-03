import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'

export async function GET(request: NextRequest) {
  const { context, error: authError } = await requireAuth(request);
  if (authError) return authError;

  try {
    const service = createServiceClient()

    // Fetch sequences first, then steps — embedding follow_steps(*) only works with FK declared
    const { data: seqList, error } = await service
      .from('follow_sequences')
      .select('*')
      .eq('company_id', context.companyId)
      .order('created_at', { ascending: true })

    if (error) throw error

    const sequences = seqList ?? []
    const seqIds = sequences.map((s: any) => s.id)

    const { data: steps } = seqIds.length > 0
      ? await service.from('follow_steps').select('*').in('sequence_id', seqIds).order('ordem')
      : { data: [] as any[] }

    const stepsBySeq: Record<string, any[]> = {}
    for (const step of steps ?? []) {
      if (!stepsBySeq[step.sequence_id]) stepsBySeq[step.sequence_id] = []
      stepsBySeq[step.sequence_id].push(step)
    }

    const sorted = sequences.map((s: any) => ({
      ...s,
      follow_steps: stepsBySeq[s.id] ?? [],
    }))

    return NextResponse.json({ sequences: sorted })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { context, error: authError } = await requireAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json()
    const { nome, tipo, ativo = true, steps = [] } = body

    if (!nome || !tipo) {
      return NextResponse.json({ error: 'nome e tipo são obrigatórios' }, { status: 400 })
    }

    const service = createServiceClient()

    const { data: sequence, error: seqErr } = await service
      .from('follow_sequences')
      .insert({ company_id: context.companyId, nome, tipo, ativo })
      .select()
      .single()

    if (seqErr) throw seqErr

    if (steps.length > 0) {
      const stepsToInsert = steps.map((s: any, i: number) => ({
        sequence_id: sequence.id,
        dia_offset: s.dia_offset ?? i + 1,
        horario: s.horario ?? '09:00',
        mensagem: s.mensagem ?? null,
        pool_mensagens: s.pool_mensagens?.length ? s.pool_mensagens : null,
        usar_ia: s.usar_ia ?? false,
        usar_contexto_sdr: s.usar_contexto_sdr ?? false,
        tipo_mensagem: s.tipo_mensagem ?? 'text',
        media_config: s.media_config ?? null,
        condicao: s.condicao ?? 'sempre',
        condicao_estagio: s.condicao_estagio ?? null,
        sdr_ativo: s.sdr_ativo ?? null,
        ordem: i,
      }))
      await service.from('follow_steps').insert(stepsToInsert)
    }

    return NextResponse.json({ sequence: { ...sequence, follow_steps: [] } }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
