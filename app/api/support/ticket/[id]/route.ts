import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'

// PATCH /api/support/ticket/[id] : user marks ticket as resolved
export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { context, error } = await requireAuth(req)
  if (error) return error

  const service = createServiceClient()

  const { data: ticket } = await service
    .from('support_tickets')
    .select('id, status')
    .eq('id', params.id)
    .eq('company_id', context.companyId)
    .maybeSingle()

  if (!ticket) return NextResponse.json({ error: 'Ticket não encontrado' }, { status: 404 })
  if (ticket.status === 'fechado') return NextResponse.json({ error: 'Ticket já está fechado' }, { status: 400 })

  const { error: updErr } = await service
    .from('support_tickets')
    .update({ status: 'fechado', updated_at: new Date().toISOString() })
    .eq('id', params.id)

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
