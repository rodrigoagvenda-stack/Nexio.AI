import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { rateLimit } from '@/lib/rate-limit'
import { sendText as waSendText, sendMedia as waSendMedia } from '@/lib/sdr/whatsapp-sender'
import { computeWindowState, canSendFreeform } from '@/lib/sdr/window'

export async function POST(request: NextRequest) {
  const { context, error: authError } = await requireAuth(request)
  if (authError) return authError

  const rl = rateLimit({ key: `wa-send:${context.companyId}`, limit: 60, windowMs: 60_000 })
  if (!rl.success) return NextResponse.json({ success: false, message: 'Muitas requisições' }, { status: 429 })

  try {
    const body = await request.json()
    const { conversationId, phoneNumber, message, messageType, mediaUrl, caption, filename, replyId, replyToText, replyToSender } = body
    const companyId = context.companyId

    if (!conversationId || !phoneNumber) {
      return NextResponse.json({ success: false, message: 'Dados obrigatórios faltando' }, { status: 400 })
    }

    const type: string = messageType || 'text'
    if (type === 'text' && !message) {
      return NextResponse.json({ success: false, message: 'Mensagem não pode estar vazia' }, { status: 400 })
    }
    if (type !== 'text' && !mediaUrl) {
      return NextResponse.json({ success: false, message: 'URL da mídia é obrigatória' }, { status: 400 })
    }

    const supabase = await createClient()

    const { data: conversation, error: convError } = await supabase
      .from('conversas_do_whatsapp')
      .select('id, company_id, id_do_lead, ultima_mensagem_inbound_at, ctwa_clid, ctwa_first_reply_at')
      .eq('id', conversationId)
      .eq('company_id', companyId)
      .single()

    if (convError || !conversation) {
      return NextResponse.json({ success: false, message: 'Conversa não encontrada ou acesso negado' }, { status: 403 })
    }

    // Janela de 24h : é regra de política da API OFICIAL da Meta (fora dela,
    // mensagem livre falha na API deles, só template aprovado passa). Achado
    // ao vivo (2026-09-04) que isso bloqueava envio manual até pra empresa
    // conectada via uazapi (Baileys/WhatsApp Web), que não tem essa restrição
    // nenhuma : é o mesmo protocolo do app normal, manda mensagem livre a
    // qualquer hora, igual mandar pelo celular.
    const { data: sdrConfig } = await supabase
      .from('sdr_configs')
      .select('whatsapp_provider')
      .eq('company_id', companyId)
      .maybeSingle()

    if (sdrConfig?.whatsapp_provider !== 'uazapi') {
      const windowState = computeWindowState({
        ultimaMensagemInboundAt: conversation.ultima_mensagem_inbound_at,
        ctwaClid: conversation.ctwa_clid,
        ctwaFirstReplyAt: conversation.ctwa_first_reply_at,
      })
      if (!canSendFreeform(windowState)) {
        return NextResponse.json(
          { success: false, code: 'OUTSIDE_WINDOW', message: 'Fora da janela de 24h : só é possível enviar template aprovado.' },
          { status: 422 }
        )
      }
    }

    let waMessageId: string | undefined
    if (type === 'text') {
      const result = await waSendText({ companyId: Number(companyId), phoneNumber, text: message, replyId: replyId || undefined })
      waMessageId = result?.id
    } else {
      const mediaType = type === 'audio' ? 'ptt' : (type as 'image' | 'video' | 'document' | 'ptt')
      const result = await waSendMedia({ companyId: Number(companyId), phoneNumber, type: mediaType, fileUrl: mediaUrl, caption: caption || undefined, filename: filename || undefined, replyId: replyId || undefined })
      waMessageId = result?.id
    }

    const fallbackText = type === 'image' ? '📷 Imagem' : type === 'document' ? '📄 Documento' : type === 'audio' ? '🎵 Áudio' : type === 'video' ? '🎥 Vídeo' : ''
    const messageData: any = {
      company_id: companyId,
      id_da_conversacao: conversationId,
      texto_da_mensagem: message || fallbackText,
      tipo_de_mensagem: type,
      direcao: 'outbound',
      sender_type: 'human',
      sender_user_id: context.userId,
      status: 'sent',
      carimbo_de_data_e_hora: new Date().toISOString(),
      url_da_midia: mediaUrl || null,
      whatsapp_message_id: waMessageId || null,
    }
    if (conversation.id_do_lead) messageData.id_do_lead = conversation.id_do_lead
    if (replyToText) messageData.reply_to_text = replyToText
    // Marca a primeira resposta a uma conversa CTWA : início real da janela de 72h grátis.
    if (conversation.ctwa_clid && !conversation.ctwa_first_reply_at) {
      supabase.from('conversas_do_whatsapp').update({ ctwa_first_reply_at: new Date().toISOString() }).eq('id', conversationId)
        .then(() => {}, () => {})
    }
    if (replyToSender) messageData.reply_to_sender = replyToSender

    const [{ data: savedMessage, error: messageError }] = await Promise.all([
      supabase.from('mensagens_do_whatsapp').insert(messageData).select().single(),
      supabase.from('conversas_do_whatsapp').update({
        ultima_mensagem: messageData.texto_da_mensagem,
        hora_da_ultima_mensagem: new Date().toISOString(),
      }).eq('id', conversationId).eq('company_id', companyId),
    ])

    if (messageError) throw messageError

    return NextResponse.json({ success: true, message: 'Mensagem enviada com sucesso', data: savedMessage })
  } catch (error: any) {
    console.error('[whatsapp/send]', error)
    return NextResponse.json({ success: false, message: error.message || 'Erro ao enviar mensagem' }, { status: 500 })
  }
}
