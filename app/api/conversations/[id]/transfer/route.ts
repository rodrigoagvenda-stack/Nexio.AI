// Transfere conversa de um atendente para outro
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { context, error: authError } = await requireAuth(req)
  if (authError) return authError

  const { to_attendant_id, notes } = await req.json()
  if (!to_attendant_id) return NextResponse.json({ error: 'to_attendant_id obrigatório' }, { status: 400 })

  const supabase = createServiceClient()
  const convId = Number(params.id)

  const { data: target } = await supabase
    .from('attendants')
    .select('id, active')
    .eq('id', to_attendant_id)
    .eq('company_id', context.companyId)
    .maybeSingle()

  if (!target) return NextResponse.json({ error: 'Atendente destino não encontrado' }, { status: 404 })
  if (!target.active) return NextResponse.json({ error: 'Atendente destino está inativo' }, { status: 400 })

  const now = new Date().toISOString()

  // Libera atribuição atual
  await supabase
    .from('conversation_assignments')
    .update({ status: 'transferida', released_at: now })
    .eq('conversation_id', convId)
    .eq('status', 'ativa')

  // Nova atribuição
  await supabase.from('conversation_assignments').insert({
    conversation_id: convId,
    attendant_id: to_attendant_id,
    assigned_at: now,
  })

  await supabase
    .from('conversas_do_whatsapp')
    .update({ current_attendant_id: to_attendant_id, current_status: 'em_atendimento' })
    .eq('id', convId)

  await supabase.from('conversation_audit_log').insert({
    conversation_id: convId,
    event_type: 'reassigned',
    actor: 'system',
    detail: { to_attendant_id, notes: notes ?? null },
  })

  return NextResponse.json({ ok: true })
}
