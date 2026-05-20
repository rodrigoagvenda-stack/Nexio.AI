import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'

export async function GET(request: NextRequest) {
  const { context, error: authError } = await requireAuth(request)
  if (authError) return authError

  const conversaId = request.nextUrl.searchParams.get('conversaId') ?? ''
  // baselineMaxId: max inbound message id known before polling started.
  // We return a message only when a new message with id > baseline arrives.
  // Using max ID instead of count avoids the .limit(N) saturation bug.
  const baselineMaxId = parseInt(request.nextUrl.searchParams.get('baselineMaxId') ?? '-1', 10)

  if (!conversaId) return NextResponse.json({ text: null, maxId: 0 })

  const service = createServiceClient()

  // Security: verify conversation belongs to this company
  const { data: conversa } = await service
    .from('conversas_do_whatsapp')
    .select('id')
    .eq('id', conversaId)
    .eq('company_id', context.companyId)
    .maybeSingle()

  if (!conversa) return NextResponse.json({ text: null, maxId: 0 })

  if (baselineMaxId >= 0) {
    // Poll mode: look for messages newer than baseline
    const { data: newRows } = await service
      .from('mensagens_do_whatsapp')
      .select('id, texto_da_mensagem')
      .eq('id_da_conversacao', conversaId)
      .eq('direcao', 'inbound')
      .gt('id', baselineMaxId)
      .order('id', { ascending: false })
      .limit(1)

    if (newRows && newRows.length > 0) {
      return NextResponse.json({ text: newRows[0].texto_da_mensagem ?? null, maxId: newRows[0].id })
    }
    return NextResponse.json({ text: null, maxId: baselineMaxId })
  }

  // Init mode: return current max id (no baselineMaxId provided)
  const { data: latest } = await service
    .from('mensagens_do_whatsapp')
    .select('id')
    .eq('id_da_conversacao', conversaId)
    .eq('direcao', 'inbound')
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle()

  return NextResponse.json({ text: null, maxId: latest?.id ?? 0 })
}
