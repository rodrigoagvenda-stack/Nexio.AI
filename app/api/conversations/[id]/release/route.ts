// Libera conversa de volta para a fila (status: livre)
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { context, error: authError } = await requireAuth(req)
  if (authError) return authError

  const supabase = createServiceClient()
  const convId = Number(params.id)
  const now = new Date().toISOString()

  await supabase
    .from('conversation_assignments')
    .update({ status: 'liberada', released_at: now })
    .eq('conversation_id', convId)
    .eq('status', 'ativa')

  await supabase
    .from('conversas_do_whatsapp')
    .update({
      current_attendant_id: null,
      current_status: 'livre',
      queue_entered_at: now,
    })
    .eq('id', convId)

  await supabase.from('conversation_audit_log').insert({
    conversation_id: convId,
    event_type: 'released',
    actor: 'system',
    detail: null,
  })

  return NextResponse.json({ ok: true })
}
