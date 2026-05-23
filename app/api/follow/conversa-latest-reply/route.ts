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

  if (!conversa) {
    console.log(`[poll] conversa ${conversaId} não encontrada para company ${context.companyId}`)
    return NextResponse.json({ text: null, count: 0 })
  }

  // Fetch inbound messages (id only) — count via data.length
  const { data: inboundRows, error: inboundErr } = await service
    .from('mensagens_do_whatsapp')
    .select('id')
    .eq('id_da_conversacao', conversaId)
    .eq('direcao', 'inbound')

  if (inboundErr) console.log(`[poll] erro ao buscar inbound: ${inboundErr.message}`)

  const current = inboundRows?.length ?? 0

  console.log(`[poll] conv=${conversaId} baselineCount=${baselineCount} current=${current}`)

  if (baselineCount >= 0) {
    if (current > baselineCount) {
      // Order by created_at (Postgres auto-timestamp, always set on INSERT, never null for new rows)
      // Do NOT filter by texto_da_mensagem IS NOT NULL — instead handle empty text below
      const { data: latest } = await service
        .from('mensagens_do_whatsapp')
        .select('texto_da_mensagem')
        .eq('id_da_conversacao', conversaId)
        .eq('direcao', 'inbound')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      console.log(`[poll] nova mensagem detectada! texto="${latest?.texto_da_mensagem?.slice(0, 60)}"`)
      if (!latest?.texto_da_mensagem) {
        // Newest row has no text yet (pre-save before saveInbound) — keep polling at same baseline
        return NextResponse.json({ text: null, count: baselineCount })
      }
      return NextResponse.json({ text: latest.texto_da_mensagem, count: current })
    }

    return NextResponse.json({ text: null, count: current })
  }

  // Init mode
  console.log(`[poll] init mode — retornando count=${current}`)
  return NextResponse.json({ text: null, count: current })
}
