import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { getUazapiForCompany } from '@/lib/sdr/uazapi-for-company'

export async function POST(request: NextRequest) {
  const { context, error: authError } = await requireAuth(request)
  if (authError) return authError

  try {
    const { messageId, conversationIds } = await request.json()
    if (!messageId || !conversationIds?.length) {
      return NextResponse.json({ success: false, message: 'Dados obrigatórios faltando' }, { status: 400 })
    }

    const supabase = await createClient()

    const [{ data: message, error: msgErr }, { data: conversations, error: convErr }, uazapi] = await Promise.all([
      supabase
        .from('mensagens_do_whatsapp')
        .select('texto_da_mensagem, tipo_de_mensagem, url_da_midia')
        .eq('id', messageId)
        .eq('company_id', context.companyId)
        .single(),
      supabase
        .from('conversas_do_whatsapp')
        .select('id, numero_de_telefone')
        .in('id', conversationIds)
        .eq('company_id', context.companyId),
      getUazapiForCompany(context.companyId),
    ])

    if (msgErr || !message) {
      return NextResponse.json({ success: false, message: 'Mensagem não encontrada' }, { status: 404 })
    }
    if (convErr || !conversations?.length) {
      return NextResponse.json({ success: false, message: 'Conversas não encontradas' }, { status: 404 })
    }

    const results = await Promise.allSettled(
      conversations.map(async (conv) => {
        let waId: string | undefined
        if (message.url_da_midia) {
          const mediaType = message.tipo_de_mensagem === 'audio' ? 'ptt'
            : (message.tipo_de_mensagem as 'image' | 'video' | 'document' | 'ptt')
          const result = await uazapi.sendMedia({
            number: conv.numero_de_telefone,
            type: mediaType,
            file: message.url_da_midia,
            text: message.texto_da_mensagem || undefined,
          })
          waId = result?.id
        } else {
          const result = await uazapi.sendText({ number: conv.numero_de_telefone, text: message.texto_da_mensagem })
          waId = result?.id
        }

        const msgData: any = {
          company_id: context.companyId,
          id_da_conversacao: conv.id,
          texto_da_mensagem: message.texto_da_mensagem,
          tipo_de_mensagem: message.tipo_de_mensagem,
          direcao: 'outbound',
          sender_type: 'human',
          sender_user_id: context.userId,
          status: 'sent',
          url_da_midia: message.url_da_midia || null,
          carimbo_de_data_e_hora: new Date().toISOString(),
        }
        // whatsapp_message_id só salvo após migração da coluna no Supabase

        await Promise.all([
          supabase.from('mensagens_do_whatsapp').insert(msgData),
          supabase.from('conversas_do_whatsapp')
            .update({ ultima_mensagem: message.texto_da_mensagem, hora_da_ultima_mensagem: new Date().toISOString() })
            .eq('id', conv.id).eq('company_id', context.companyId),
        ])

        return { conversationId: conv.id, success: true }
      })
    )

    const successful = results.filter(r => r.status === 'fulfilled').length
    const failed = results.filter(r => r.status === 'rejected').length

    return NextResponse.json({
      success: true,
      message: failed > 0
        ? `Mensagem encaminhada para ${successful} de ${results.length} contatos`
        : `Mensagem encaminhada com sucesso para ${successful} contatos`,
      stats: { successful, failed, total: results.length },
    })
  } catch (error: any) {
    console.error('[whatsapp/forward]', error)
    return NextResponse.json({ success: false, message: error.message || 'Erro ao encaminhar mensagem' }, { status: 500 })
  }
}
