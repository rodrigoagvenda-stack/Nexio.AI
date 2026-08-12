// Atendente pega conversa livre (self-assign)
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { context, error: authError } = await requireAuth(req)
  if (authError) return authError

  const supabase = createServiceClient()
  const convId = Number(params.id)

  // Busca o attendant vinculado ao usuário logado
  const { data: attendant } = await supabase
    .from('attendants')
    .select('id, active')
    .eq('user_id', context.userId)
    .eq('company_id', context.companyId)
    .maybeSingle()

  if (!attendant) return NextResponse.json({ error: 'Usuário não está cadastrado como atendente' }, { status: 403 })
  if (!attendant.active) return NextResponse.json({ error: 'Atendente inativo' }, { status: 403 })

  // Verifica limite de conversas simultâneas
  const { data: limitRow } = await supabase
    .from('attendant_limits')
    .select('max_concurrent_conversations')
    .eq('attendant_id', attendant.id)
    .maybeSingle()

  const maxConvs = limitRow?.max_concurrent_conversations ?? 15

  const { count: activeCount } = await supabase
    .from('conversation_assignments')
    .select('id', { count: 'exact', head: true })
    .eq('attendant_id', attendant.id)
    .eq('status', 'ativa')

  if ((activeCount ?? 0) >= maxConvs) {
    return NextResponse.json({ error: `Limite de ${maxConvs} conversas simultâneas atingido` }, { status: 429 })
  }

  const now = new Date().toISOString()

  const { error: assignErr } = await supabase.from('conversation_assignments').insert({
    conversation_id: convId,
    attendant_id: attendant.id,
    assigned_at: now,
  })
  if (assignErr) return NextResponse.json({ error: assignErr.message }, { status: 500 })

  await supabase
    .from('conversas_do_whatsapp')
    .update({ current_attendant_id: attendant.id, current_status: 'em_atendimento' })
    .eq('id', convId)

  await supabase.from('conversation_audit_log').insert({
    conversation_id: convId,
    event_type: 'assigned',
    actor: attendant.id,
    detail: { self_assign: true },
  })

  return NextResponse.json({ ok: true, attendant_id: attendant.id })
}
