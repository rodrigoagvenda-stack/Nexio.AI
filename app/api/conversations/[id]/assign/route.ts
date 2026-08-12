// Supervisor atribui conversa a um atendente específico
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { context, error: authError } = await requireAuth(req)
  if (authError) return authError

  const { attendant_id } = await req.json()
  if (!attendant_id) return NextResponse.json({ error: 'attendant_id obrigatório' }, { status: 400 })

  const supabase = createServiceClient()
  const convId = Number(params.id)

  // Verifica se o atendente pertence à mesma empresa
  const { data: attendant } = await supabase
    .from('attendants')
    .select('id, active')
    .eq('id', attendant_id)
    .eq('company_id', context.companyId)
    .maybeSingle()

  if (!attendant) return NextResponse.json({ error: 'Atendente não encontrado' }, { status: 404 })
  if (!attendant.active) return NextResponse.json({ error: 'Atendente inativo' }, { status: 400 })

  const now = new Date().toISOString()

  // Libera atribuição anterior (se houver)
  await supabase
    .from('conversation_assignments')
    .update({ status: 'transferida', released_at: now })
    .eq('conversation_id', convId)
    .eq('status', 'ativa')

  // Cria nova atribuição
  const { error: assignErr } = await supabase.from('conversation_assignments').insert({
    conversation_id: convId,
    attendant_id,
    assigned_at: now,
  })
  if (assignErr) return NextResponse.json({ error: assignErr.message }, { status: 500 })

  // Atualiza conversa
  await supabase
    .from('conversas_do_whatsapp')
    .update({ current_attendant_id: attendant_id, current_status: 'em_atendimento' })
    .eq('id', convId)

  // Log de auditoria
  await supabase.from('conversation_audit_log').insert({
    conversation_id: convId,
    event_type: 'assigned',
    actor: 'system',
    detail: { attendant_id },
  })

  return NextResponse.json({ ok: true })
}
