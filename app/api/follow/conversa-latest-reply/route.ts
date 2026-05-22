import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'

export async function GET(request: NextRequest) {
  const { context, error: authError } = await requireAuth(request)
  if (authError) return authError

  const conversaId = request.nextUrl.searchParams.get('conversaId') ?? ''
  // since: ISO timestamp baseline captured before message send.
  // Poll mode when provided, init mode when absent.
  const since = request.nextUrl.searchParams.get('since') ?? ''

  if (!conversaId) return NextResponse.json({ text: null, ts: null })

  const service = createServiceClient()

  // Security: verify conversation belongs to this company
  const { data: conversa } = await service
    .from('conversas_do_whatsapp')
    .select('id')
    .eq('id', conversaId)
    .eq('company_id', context.companyId)
    .maybeSingle()

  if (!conversa) return NextResponse.json({ text: null, ts: null })

  if (since) {
    // Poll mode: look for inbound messages newer than baseline timestamp
    const { data: newRows } = await service
      .from('mensagens_do_whatsapp')
      .select('texto_da_mensagem, carimbo_de_data_e_hora')
      .eq('id_da_conversacao', conversaId)
      .eq('direcao', 'inbound')
      .gt('carimbo_de_data_e_hora', since)
      .order('carimbo_de_data_e_hora', { ascending: false })
      .limit(1)

    if (newRows && newRows.length > 0) {
      return NextResponse.json({
        text: newRows[0].texto_da_mensagem ?? null,
        ts: newRows[0].carimbo_de_data_e_hora,
      })
    }
    return NextResponse.json({ text: null, ts: since })
  }

  // Init mode: return current max timestamp for inbound messages
  const { data: latest } = await service
    .from('mensagens_do_whatsapp')
    .select('carimbo_de_data_e_hora')
    .eq('id_da_conversacao', conversaId)
    .eq('direcao', 'inbound')
    .order('carimbo_de_data_e_hora', { ascending: false })
    .limit(1)
    .maybeSingle()

  return NextResponse.json({ text: null, ts: latest?.carimbo_de_data_e_hora ?? new Date().toISOString() })
}
