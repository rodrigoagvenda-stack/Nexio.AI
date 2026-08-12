import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { context, error: authError } = await requireAuth(req)
  if (authError) return authError

  const body = await req.json()
  const allowed = ['friendly_name', 'status', 'sdr_enabled', 'phone_number_id', 'waba_id', 'token']
  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nenhum campo válido para atualizar' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('meta_wa_numbers')
    .update(updates)
    .eq('id', params.id)
    .eq('company_id', context.companyId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Número não encontrado' }, { status: 404 })
  return NextResponse.json({ data })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { context, error: authError } = await requireAuth(req)
  if (authError) return authError

  const supabase = createServiceClient()

  // Desconecta (não deleta) — mantém histórico de conversas
  const { data, error } = await supabase
    .from('meta_wa_numbers')
    .update({ status: 'desconectado' })
    .eq('id', params.id)
    .eq('company_id', context.companyId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Número não encontrado' }, { status: 404 })
  return NextResponse.json({ data })
}
