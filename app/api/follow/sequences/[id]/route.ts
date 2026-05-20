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
      // Fetch existing step IDs before touching anything — if insert fails, old steps survive
      const { data: existingRows } = await service.from('follow_steps').select('id').eq('sequence_id', params.id)
      const existingIds: string[] = (existingRows ?? []).map((r: any) => r.id)

      // Insert new steps FIRST — if this fails, old steps are still intact (no data loss)
      if (steps.length > 0) {
        const { error: insErr } = await service.from('follow_steps').insert(steps.map((s: any, i: number) => ({
          sequence_id: params.id,
          dia_offset: s.dia_offset ?? i + 1,
          horario: s.horario ?? '09:00',
          mensagem: s.mensagem || null,
          pool_mensagens: s.pool_mensagens?.length ? s.pool_mensagens : null,
          usar_ia: s.usar_ia ?? false,
          usar_contexto_sdr: s.usar_contexto_sdr ?? false,
          tipo_mensagem: s.tipo_mensagem || 'texto',
          media_config: s.media_config ?? null,
          condicao: s.condicao || null,
          condicao_estagio: s.condicao_estagio ?? null,
          sdr_ativo: s.sdr_ativo ?? null,
          ordem: i,
        })))
        if (insErr) throw insErr
      }

      // Delete OLD steps only after insert succeeded
      if (existingIds.length > 0) {
        const { error: delErr } = await service.from('follow_steps').delete().in('id', existingIds)
        if (delErr) throw delErr
      }
    }

    // Save canvas_config (positions + edges) if provided
    if (body.canvas_config !== undefined) {
      await service.from('follow_sequences').update({ canvas_config: body.canvas_config }).eq('id', params.id)
    }

    // Fetch separately to avoid depending on FK embedding (follow_steps(*))
    const [{ data: seqData }, { data: stepsData }] = await Promise.all([
      service.from('follow_sequences').select('*').eq('id', params.id).single(),
      service.from('follow_steps').select('*').eq('sequence_id', params.id).order('ordem'),
    ])
    return NextResponse.json({ sequence: { ...seqData, follow_steps: stepsData ?? [] } })
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
