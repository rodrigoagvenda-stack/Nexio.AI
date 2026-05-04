import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const { context, error: authError } = await requireAuth(request);
  if (authError) return authError;

  try {
    const service = createServiceClient()

    const { data: existing } = await service.from('follow_sequences').select('id').eq('id', params.id).eq('company_id', context.companyId).single()
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

    if (Array.isArray(steps)) {
      await service.from('follow_steps').delete().eq('sequence_id', params.id)
      if (steps.length > 0) {
        await service.from('follow_steps').insert(steps.map((s: any, i: number) => ({
          sequence_id: params.id,
          dia_offset: s.dia_offset ?? i + 1,
          horario: s.horario ?? '09:00',
          mensagem: s.mensagem ?? null,
          pool_mensagens: s.pool_mensagens?.length ? s.pool_mensagens : null,
          usar_ia: s.usar_ia ?? false,
          usar_contexto_sdr: s.usar_contexto_sdr ?? false,
          ordem: i,
        })))
      }
    }

    const { data: updated } = await service.from('follow_sequences').select('*, follow_steps(*)').eq('id', params.id).single()
    return NextResponse.json({ sequence: updated })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const { context, error: authError } = await requireAuth(request);
  if (authError) return authError;

  try {
    const service = createServiceClient()
    const { error } = await service.from('follow_sequences').delete().eq('id', params.id).eq('company_id', context.companyId)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
