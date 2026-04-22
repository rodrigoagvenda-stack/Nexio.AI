import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// GET /api/follow/sequences — lista cadências com steps
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { data: userData } = await supabase
      .from('users')
      .select('company_id')
      .eq('auth_user_id', user.id)
      .single()
    if (!userData) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

    const service = createServiceClient()
    const { data: sequences, error } = await service
      .from('follow_sequences')
      .select(`
        *,
        follow_steps (*)
      `)
      .eq('company_id', userData.company_id)
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

// POST /api/follow/sequences — cria cadência com steps
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { data: userData } = await supabase
      .from('users')
      .select('company_id')
      .eq('auth_user_id', user.id)
      .single()
    if (!userData) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

    const body = await request.json()
    const { nome, tipo, ativo = true, steps = [] } = body

    if (!nome || !tipo) {
      return NextResponse.json({ error: 'nome e tipo são obrigatórios' }, { status: 400 })
    }

    const service = createServiceClient()

    const { data: sequence, error: seqErr } = await service
      .from('follow_sequences')
      .insert({ company_id: userData.company_id, nome, tipo, ativo })
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
