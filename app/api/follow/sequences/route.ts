import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'

export async function GET(request: NextRequest) {
  const { context, error: authError } = await requireAuth(request);
  if (authError) return authError;

  try {
    const service = createServiceClient()
    const { data: sequences, error } = await service
      .from('follow_sequences')
      .select('*, follow_steps (*)')
      .eq('company_id', context.companyId)
      .order('created_at', { ascending: true })

    if (error) throw error

    const sorted = (sequences ?? []).map((s: any) => ({
      ...s,
      follow_steps: (s.follow_steps ?? []).sort((a: any, b: any) => a.ordem - b.ordem),
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
        usar_ia: s.usar_ia ?? false,
        ordem: i,
      }))
      await service.from('follow_steps').insert(stepsToInsert)
    }

    return NextResponse.json({ sequence }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
