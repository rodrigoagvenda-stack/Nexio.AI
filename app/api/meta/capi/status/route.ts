import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'

export const dynamic = 'force-dynamic'

// Resultado dos últimos envios de conversão para a Meta, para o painel Pixel mostrar se a Meta aceitou.
export async function GET(req: NextRequest) {
  const { context, error: authError } = await requireAuth(req)
  if (authError) return authError

  const supabase = createServiceClient()
  const { data: convs } = await supabase.from('conversas_do_whatsapp').select('id').eq('company_id', context.companyId).limit(20000)
  const ids = (convs ?? []).map((c) => c.id as number)
  if (ids.length === 0) return NextResponse.json({ sent: 0, failed: 0, last: null })

  const { data: logs } = await supabase
    .from('conversions_api_log')
    .select('success, sent_at, response_body')
    .in('conversation_id', ids)
    .order('sent_at', { ascending: false })
    .limit(50)

  const rows = logs ?? []
  const last = rows[0]
  const err = (last?.response_body as { error?: { error_user_msg?: string; message?: string } } | null)?.error
  return NextResponse.json({
    sent: rows.filter((r) => r.success).length,
    failed: rows.filter((r) => !r.success).length,
    last: last ? { success: !!last.success, at: last.sent_at, message: last.success ? null : (err?.error_user_msg ?? err?.message ?? 'A Meta recusou o evento') } : null,
  })
}
