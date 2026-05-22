import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'

export async function GET(req: NextRequest) {
  const { context, error } = await requireAuth(req)
  if (error) return error

  const service = createServiceClient()
  const { data, error: dbErr } = await service
    .from('support_tickets')
    .select('id, protocolo, assunto, mensagem, status, resposta, respondido_em, created_at, images')
    .eq('company_id', context.companyId)
    .order('created_at', { ascending: false })

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ tickets: data ?? [] })
}
