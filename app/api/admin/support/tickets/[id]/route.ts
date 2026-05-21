import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { sendSuporteConfirmacaoEmail } from '@/lib/email/resend'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { context, error } = await requireAuth(req)
  if (error) return error
  if (context.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

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
