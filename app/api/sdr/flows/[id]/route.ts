import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const { context, error: authError } = await requireAuth(request);
  if (authError) return authError;

  try {
    const service = createServiceClient()

    const { data: existing } = await service.from('sdr_flows').select('id').eq('id', params.id).eq('company_id', context.companyId).single()
    if (!existing) return NextResponse.json({ error: 'Fluxo não encontrado' }, { status: 404 })

    const body = await request.json()
    const allowed = ['nome', 'descricao', 'numero_whatsapp', 'tipo', 'ativo', 'orchestrator_prompt', 'conhecimento_ativo', 'objecoes_ativo', 'vector_table_conhecimento', 'vector_table_objecoes', 'event_title_template']
    const updates: Record<string, any> = {}
    for (const key of allowed) {
      if (body[key] !== undefined) updates[key] = body[key]
    }

    const { data: flow, error } = await service.from('sdr_flows').update(updates).eq('id', params.id).select().single()
    if (error) throw error

    return NextResponse.json({ flow })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const { context, error: authError } = await requireAuth(request);
  if (authError) return authError;

  try {
    const service = createServiceClient()
    const { error } = await service.from('sdr_flows').delete().eq('id', params.id).eq('company_id', context.companyId)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
