import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// PATCH /api/follow/sequences/:id — atualiza cadência e recria steps
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const { data: existing } = await service
      .from('follow_sequences')
      .select('id')
      .eq('id', params.id)
      .eq('company_id', userData.company_id)
      .single()

    if (!existing) return NextResponse.json({ error: 'Cadência não encontrada' }, { status: 404 })

    const body = await request.json()
    const { nome, tipo, ativo, steps } = body

    const updates: Record<string, any> = {}
    if (nome !== undefined) updates.nome = nome
    if (tipo !== undefined) updates.tipo = tipo
    if (ativo !== undefined) updates.ativo = ativo

    if (Object.keys(updates).length > 0) {
      await service.from('follow_sequences').update(updates).eq('id', params.id)
    }

    // Recria steps se fornecidos
    if (Array.isArray(steps)) {
      await service.from('follow_steps').delete().eq('sequence_id', params.id)

      if (steps.length > 0) {
        const stepsToInsert = steps.map((s: any, i: number) => ({
          sequence_id: params.id,
          dia_offset: s.dia_offset ?? i + 1,
          horario: s.horario ?? '09:00',
          mensagem: s.mensagem ?? null,
          usar_ia: s.usar_ia ?? false,
          ordem: i,
        }))
        await service.from('follow_steps').insert(stepsToInsert)
      }
    }

    const { data: updated } = await service
      .from('follow_sequences')
      .select('*, follow_steps(*)')
      .eq('id', params.id)
      .single()

    return NextResponse.json({ sequence: updated })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE /api/follow/sequences/:id
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const { error } = await service
      .from('follow_sequences')
      .delete()
      .eq('id', params.id)
      .eq('company_id', userData.company_id)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
