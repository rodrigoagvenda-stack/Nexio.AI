import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'

export async function GET(req: NextRequest) {
  const { context, error: authError } = await requireAuth(req)
  if (authError) return authError

  const url = new URL(req.url)
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50', 10), 200)
  const offset = parseInt(url.searchParams.get('offset') ?? '0', 10)
  const eventType = url.searchParams.get('action')
  const since = url.searchParams.get('since')

  const supabase = createServiceClient()

  // conversation_audit_log links via conversas_do_whatsapp (company_id filter)
  let query = supabase
    .from('conversation_audit_log')
    .select(
      `id, event_type, actor, detail, created_at,
       conversation_id,
       conversas_do_whatsapp!inner(company_id)`,
      { count: 'exact' }
    )
    .eq('conversas_do_whatsapp.company_id', context.companyId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (eventType) query = query.eq('event_type', eventType)
  if (since) query = query.gte('created_at', since)

  const { data, error, count } = await query

  if (error) {
    if (error.message?.includes('does not exist')) return NextResponse.json({ data: [], total: 0, migration_pending: true })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ data, total: count ?? 0 })
}

export async function POST(req: NextRequest) {
  const { context, error: authError } = await requireAuth(req)
  if (authError) return authError

  const { event_type, conversation_id, actor, detail } = await req.json()
  if (!event_type || !conversation_id) {
    return NextResponse.json({ error: 'event_type e conversation_id são obrigatórios' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Verify conversation belongs to this company
  const { data: conv } = await supabase
    .from('conversas_do_whatsapp')
    .select('id')
    .eq('id', conversation_id)
    .eq('company_id', context.companyId)
    .maybeSingle()

  if (!conv) return NextResponse.json({ error: 'Conversa não encontrada' }, { status: 404 })

  const { data, error } = await supabase.from('conversation_audit_log').insert({
    event_type,
    conversation_id,
    actor: actor ?? 'system',
    detail: detail ?? null,
  }).select().single()

  if (error) {
    if (error.message?.includes('does not exist')) return NextResponse.json({ error: 'Migration pendente', migration_pending: true }, { status: 503 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ data }, { status: 201 })
}
