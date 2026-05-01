import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { getUazapiForCompany } from '@/lib/sdr/uazapi-for-company'

export async function POST(request: NextRequest) {
  const { context, error: authError } = await requireAuth(request)
  if (authError) return authError

  try {
    const { messageId, deleteForEveryone } = await request.json()
    if (!messageId) {
      return NextResponse.json({ success: false, message: 'messageId é obrigatório' }, { status: 400 })
    }

    const supabase = await createClient()

    const { data: message, error: msgErr } = await supabase
      .from('mensagens_do_whatsapp')
      .select('id, id_da_conversacao, whatsapp_message_id')
      .eq('id', messageId)
      .eq('company_id', context.companyId)
      .single()

    if (msgErr || !message) {
      return NextResponse.json({ success: false, message: 'Mensagem não encontrada' }, { status: 404 })
    }

    if (deleteForEveryone && message.whatsapp_message_id) {
      const uazapi = await getUazapiForCompany(context.companyId)
      await uazapi.deleteMessage(message.whatsapp_message_id)
    }

    const { error: deleteError } = await supabase
      .from('mensagens_do_whatsapp')
      .delete()
      .eq('id', messageId)
      .eq('company_id', context.companyId)

    if (deleteError) throw deleteError

    return NextResponse.json({
      success: true,
      message: deleteForEveryone ? 'Mensagem apagada para todos' : 'Mensagem apagada para você',
    })
  } catch (error: any) {
    console.error('[whatsapp/delete]', error)
    return NextResponse.json({ success: false, message: error.message || 'Erro ao apagar mensagem' }, { status: 500 })
  }
}
