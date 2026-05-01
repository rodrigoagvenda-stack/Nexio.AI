import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { getUazapiForCompany, toJid } from '@/lib/sdr/uazapi-for-company'

export async function POST(request: NextRequest) {
  const { context, error: authError } = await requireAuth(request)
  if (authError) return authError

  try {
    const { messageId, emoji } = await request.json()
    if (!messageId || !emoji) {
      return NextResponse.json({ success: false, message: 'Dados obrigatórios faltando' }, { status: 400 })
    }

    const supabase = await createClient()

    const [{ data: message, error: msgErr }, uazapi] = await Promise.all([
      supabase
        .from('mensagens_do_whatsapp')
        .select('id, id_da_conversacao, whatsapp_message_id')
        .eq('id', messageId)
        .eq('company_id', context.companyId)
        .single(),
      getUazapiForCompany(context.companyId),
    ])

    if (msgErr || !message) {
      return NextResponse.json({ success: false, message: 'Mensagem não encontrada' }, { status: 404 })
    }

    const { data: conversation } = await supabase
      .from('conversas_do_whatsapp')
      .select('numero_de_telefone')
      .eq('id', message.id_da_conversacao)
      .single()

    if (!conversation) {
      return NextResponse.json({ success: false, message: 'Conversa não encontrada' }, { status: 404 })
    }

    if (message.whatsapp_message_id) {
      await uazapi.reactToMessage(toJid(conversation.numero_de_telefone), message.whatsapp_message_id, emoji)
    }

    return NextResponse.json({ success: true, message: 'Reação enviada com sucesso' })
  } catch (error: any) {
    console.error('[whatsapp/react]', error)
    return NextResponse.json({ success: false, message: error.message || 'Erro ao enviar reação' }, { status: 500 })
  }
}
