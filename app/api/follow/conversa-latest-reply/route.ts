import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'

export async function GET(request: NextRequest) {
  const { context, error: authError } = await requireAuth(request)
  if (authError) return authError

  const conversaId = request.nextUrl.searchParams.get('conversaId') ?? ''
  // baselineCount: number of inbound messages known before polling started.
  // We return a message only when count exceeds this baseline (timezone-agnostic).
  const baselineCount = parseInt(request.nextUrl.searchParams.get('baselineCount') ?? '-1', 10)

  if (!conversaId) return NextResponse.json({ text: null, count: 0 })

  const service = createServiceClient()

  // Security: verify conversation belongs to this company
  const { data: conversa } = await service
    .from('conversas_do_whatsapp')
    .select('id')
    .eq('id', conversaId)
    .eq('company_id', context.companyId)
    .maybeSingle()

  if (!conversa) return NextResponse.json({ text: null, count: 0 })

  // Fetch all inbound messages (ordered by id desc to get latest first)
  const { data: rows } = await service
    .from('mensagens_do_whatsapp')
    .select('id, texto_da_mensagem')
    .eq('id_da_conversacao', conversaId)
    .eq('direcao', 'inbound')
    .order('id', { ascending: false })
    .limit(50)

  const count = rows?.length ?? 0

  // Return the latest message only if count grew beyond baseline
  if (baselineCount >= 0 && count > baselineCount) {
    return NextResponse.json({ text: rows?.[0]?.texto_da_mensagem ?? null, count })
  }

  // Called without baselineCount → just return current count (for initialization)
  return NextResponse.json({ text: null, count })
}
