import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'

export async function GET(req: NextRequest) {
  const { context, error } = await requireAuth(req)
  if (error) return error
  if (context.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const service = createServiceClient()
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')

  let query = service
    .from('support_tickets')
    .select('id, protocolo, nome, email, assunto, mensagem, status, resposta, respondido_em, created_at, companies(name)')
    .order('created_at', { ascending: false })

  if (status && status !== 'todos') query = query.eq('status', status)

  const { data, error: dbErr } = await query
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ tickets: data ?? [] })
}
