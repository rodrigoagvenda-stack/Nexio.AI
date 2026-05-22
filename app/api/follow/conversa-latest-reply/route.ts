import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'

export async function GET(request: NextRequest) {
  const { context, error: authError } = await requireAuth(request)
  if (authError) return authError

  const conversaId = request.nextUrl.searchParams.get('conversaId') ?? ''
  // baselineCount: number of inbound messages known before polling started.
  // Poll mode when provided (>= 0), init mode when absent.
  const baselineCountParam = request.nextUrl.searchParams.get('baselineCount')
  const baselineCount = baselineCountParam !== null ? parseInt(baselineCountParam, 10) : -1

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

  if (baselineCount >= 0) {
    // Poll mode: check if new inbound message arrived
    const { count: currentCount } = await service
      .from('mensagens_do_whatsapp')
      .select('*', { count: 'exact', head: true })
      .eq('id_da_conversacao', conversaId)
      .eq('direcao', 'inbound')

    const current = currentCount ?? 0

    if (current > baselineCount) {
      // New message arrived — get its text
      const { data: latest } = await service
        .from('mensagens_do_whatsapp')
        .select('texto_da_mensagem')
        .eq('id_da_conversacao', conversaId)
        .eq('direcao', 'inbound')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      return NextResponse.json({ text: latest?.texto_da_mensagem ?? null, count: current })
    }

    return NextResponse.json({ text: null, count: current })
  }

  // Init mode: return current count of inbound messages
  const { count } = await service
    .from('mensagens_do_whatsapp')
    .select('*', { count: 'exact', head: true })
    .eq('id_da_conversacao', conversaId)
    .eq('direcao', 'inbound')

  return NextResponse.json({ text: null, count: count ?? 0 })
}
