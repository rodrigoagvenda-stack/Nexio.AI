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
    const { newMessage } = await req.json()

    if (!newMessage?.trim()) {
      return NextResponse.json({ success: false, message: 'Mensagem não pode estar vazia' }, { status: 400 })
    }

    const supabase = await createClient()

    const { data: message, error: msgErr } = await supabase
      .from('mensagens_do_whatsapp')
      .select('*')
      .eq('id', messageId)
      .eq('company_id', context.companyId)
      .single()

    if (msgErr || !message) {
      return NextResponse.json({ success: false, message: 'Mensagem não encontrada' }, { status: 404 })
    }
    if (message.direcao !== 'outbound') {
      return NextResponse.json({ success: false, message: 'Só é possível editar mensagens enviadas por você' }, { status: 403 })
    }

    const waId = message.whatsapp_message_id || message.id_externo
    if (waId) {
      try {
        const uazapi = await getUazapiForCompany(context.companyId)
        await uazapi.editMessage(waId, newMessage.trim())
      } catch (e) {
        console.error('[whatsapp/edit] uazapi error (non-fatal):', e)
      }
    }

    // Update text first (always works)
    const { data: updatedMessage, error: updateError } = await supabase
      .from('mensagens_do_whatsapp')
      .update({ texto_da_mensagem: newMessage.trim() })
      .eq('id', messageId)
      .eq('company_id', context.companyId)
      .select()
      .single()

    if (updateError) throw updateError

    // Try to set is_edited / edited_at : non-fatal if columns don't exist yet
    try {
      await supabase
        .from('mensagens_do_whatsapp')
        .update({ is_edited: true, edited_at: new Date().toISOString() } as any)
        .eq('id', messageId)
        .eq('company_id', context.companyId)
    } catch {}

    return NextResponse.json({
      success: true,
      message: 'Mensagem editada com sucesso',
      data: { ...updatedMessage, is_edited: true, edited_at: new Date().toISOString() },
    })
  } catch (error: any) {
    console.error('[whatsapp/messages/edit]', error)
    return NextResponse.json({ success: false, message: error.message || 'Erro ao editar mensagem' }, { status: 500 })
  }
}
