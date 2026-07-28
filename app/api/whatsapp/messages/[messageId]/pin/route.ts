import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { getUazapiForCompany } from '@/lib/sdr/uazapi-for-company'

export async function PATCH(req: NextRequest, props: { params: Promise<{ messageId: string }> }) {
  const params = await props.params;
  const { context, error: authError } = await requireAuth(req)
  if (authError) return authError

  try {
    const { messageId } = params
    const { isPinned } = await req.json()

    if (typeof isPinned !== 'boolean') {
      return NextResponse.json({ success: false, message: 'isPinned deve ser um boolean' }, { status: 400 })
    }

    const supabase = await createClient()

    if (isPinned) {
      const { data: msg } = await supabase
        .from('mensagens_do_whatsapp')
        .select('id_da_conversacao')
        .eq('id', messageId)
        .eq('company_id', context.companyId)
        .single()
      if (msg?.id_da_conversacao) {
        await supabase
          .from('mensagens_do_whatsapp')
          .update({ is_pinned: false })
          .eq('id_da_conversacao', msg.id_da_conversacao)
          .eq('company_id', context.companyId)
          .eq('is_pinned', true)
      }
    }

    const { data: updatedMessage, error: updateError } = await supabase
      .from('mensagens_do_whatsapp')
      .update({ is_pinned: isPinned })
      .eq('id', messageId)
      .eq('company_id', context.companyId)
      .select()
      .single()

    if (updateError) throw updateError

    const waId = updatedMessage.whatsapp_message_id || updatedMessage.id_externo
    if (waId) {
      try {
        const uazapi = await getUazapiForCompany(context.companyId)
        await uazapi.pinMessage(waId, isPinned)
      } catch (e) {
        console.error('[whatsapp/pin] uazapi error (non-fatal):', e)
      }
    }

    return NextResponse.json({
      success: true,
      message: isPinned ? 'Mensagem fixada com sucesso' : 'Mensagem desafixada com sucesso',
      data: updatedMessage,
    })
  } catch (error: any) {
    console.error('[whatsapp/messages/pin]', error)
    return NextResponse.json({ success: false, message: error.message || 'Erro ao fixar mensagem' }, { status: 500 })
  }
}
