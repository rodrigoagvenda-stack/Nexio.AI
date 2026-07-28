import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/require-auth'
import { sendSuporteConfirmacaoEmail } from '@/lib/email/resend'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { error } = await requireAdmin(req)
  if (error) return error

  const body = await req.json()
  const { status, resposta } = body as { status?: string; resposta?: string }

  const service = createServiceClient()
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (status) updates.status = status
  if (resposta !== undefined) {
    updates.resposta = resposta
    updates.respondido_em = new Date().toISOString()
    if (!status) updates.status = 'respondido'
  }

  const { data, error: dbErr } = await service
    .from('support_tickets')
    .update(updates)
    .eq('id', params.id)
    .select('protocolo, nome, email, assunto, status')
    .maybeSingle()

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

  // Also insert support reply into messages table (best-effort)
  if (resposta) {
    await service
      .from('support_ticket_messages')
      .insert({ ticket_id: params.id, sender_type: 'support', content: resposta })
      .then(undefined, () => {})
  }

  // Send email notification when admin responds
  if (resposta && data) {
    void sendSuporteConfirmacaoEmail({
      nome: data.nome,
      email: data.email,
      assunto: data.assunto,
      protocolo: data.protocolo,
    }).catch(() => {})
  }

  return NextResponse.json({ success: true, ticket: data })
}
