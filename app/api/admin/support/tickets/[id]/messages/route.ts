import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/require-auth'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { error } = await requireAdmin(req)
  if (error) return error

  const service = createServiceClient()

  const { data: ticket } = await service
    .from('support_tickets')
    .select('id, mensagem, resposta, respondido_em, created_at')
    .eq('id', params.id)
    .maybeSingle()

  if (!ticket) return NextResponse.json({ error: 'Ticket não encontrado' }, { status: 404 })

  const { data: messages, error: msgErr } = await service
    .from('support_ticket_messages')
    .select('id, sender_type, content, created_at')
    .eq('ticket_id', params.id)
    .order('created_at', { ascending: true })

  if (msgErr || !messages || messages.length === 0) {
    const legacy = []
    if (ticket.mensagem) legacy.push({ id: 'legacy-user', sender_type: 'user', content: ticket.mensagem, created_at: ticket.created_at })
    if (ticket.resposta) legacy.push({ id: 'legacy-support', sender_type: 'support', content: ticket.resposta, created_at: ticket.respondido_em ?? ticket.created_at })
    return NextResponse.json({ messages: legacy })
  }

  return NextResponse.json({ messages })
}
