import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'

export const dynamic = 'force-dynamic'

// GET — list messages for a ticket
export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { context, error } = await requireAuth(req)
  if (error) return error

  const service = createServiceClient()

  // Ensure ticket belongs to this company
  const { data: ticket } = await service
    .from('support_tickets')
    .select('id, mensagem, resposta, respondido_em, created_at')
    .eq('id', params.id)
    .eq('company_id', context.companyId)
    .maybeSingle()

  if (!ticket) return NextResponse.json({ error: 'Ticket não encontrado' }, { status: 404 })

  const { data: messages, error: msgErr } = await service
    .from('support_ticket_messages')
    .select('id, sender_type, content, created_at')
    .eq('ticket_id', params.id)
    .order('created_at', { ascending: true })

  // If table doesn't exist yet, fall back to legacy fields
  if (msgErr) {
    const legacy = []
    if (ticket.mensagem) {
      legacy.push({ id: 'legacy-user', sender_type: 'user', content: ticket.mensagem, created_at: ticket.created_at })
    }
    if (ticket.resposta) {
      legacy.push({ id: 'legacy-support', sender_type: 'support', content: ticket.resposta, created_at: ticket.respondido_em ?? ticket.created_at })
    }
    return NextResponse.json({ messages: legacy })
  }

  // If table exists but is empty (migration not yet run), seed from legacy fields
  if (!messages || messages.length === 0) {
    const legacy = []
    if (ticket.mensagem) {
      legacy.push({ id: 'legacy-user', sender_type: 'user', content: ticket.mensagem, created_at: ticket.created_at })
    }
    if (ticket.resposta) {
      legacy.push({ id: 'legacy-support', sender_type: 'support', content: ticket.resposta, created_at: ticket.respondido_em ?? ticket.created_at })
    }
    return NextResponse.json({ messages: legacy })
  }

  return NextResponse.json({ messages })
}

// POST — user sends a reply
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { context, error } = await requireAuth(req)
  if (error) return error

  const body = await req.json()
  const content = (body.content as string)?.trim()
  if (!content || content.length < 2) {
    return NextResponse.json({ error: 'Mensagem muito curta.' }, { status: 422 })
  }

  const service = createServiceClient()

  // Verify ownership
  const { data: ticket } = await service
    .from('support_tickets')
    .select('id, status')
    .eq('id', params.id)
    .eq('company_id', context.companyId)
    .maybeSingle()

  if (!ticket) return NextResponse.json({ error: 'Ticket não encontrado' }, { status: 404 })

  const { data: msg, error: insertErr } = await service
    .from('support_ticket_messages')
    .insert({ ticket_id: params.id, sender_type: 'user', content })
    .select()
    .single()

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })

  // Reopen ticket if it was closed/responded
  if (ticket.status === 'respondido' || ticket.status === 'fechado') {
    await service
      .from('support_tickets')
      .update({ status: 'em_atendimento', updated_at: new Date().toISOString() })
      .eq('id', params.id)
  }

  return NextResponse.json({ message: msg }, { status: 201 })
}
