import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendWhatsAppMessage } from '@/lib/n8n/client';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      conversationId,
      phoneNumber,
      message,
      messageType = 'text',
      mediaUrl,
      caption,
      filename,
      companyId,
      userId,
    } = body;

    if (!conversationId || !phoneNumber || !companyId) {
      return NextResponse.json(
        { success: false, message: 'Dados obrigatórios faltando' },
        { status: 400 }
      );
    }

    // Validar que tem conteúdo (texto ou mídia)
    if (!message && !mediaUrl) {
      return NextResponse.json(
        { success: false, message: 'Mensagem ou mídia é obrigatória' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // 1. Enviar mensagem via n8n/WhatsApp
    const whatsappResult = await sendWhatsAppMessage({
      number: phoneNumber,
      text: message || caption || '',
      messageType,
      mediaUrl,
      caption,
      filename,
      company_id: parseInt(companyId),
      instance_name: 'default',
      instance_token: 'default',
      conversa_id: conversationId.toString(),
      lead_id: '',
      message_id: '',
    });

    if (!whatsappResult.success) {
      throw new Error('Erro ao enviar mensagem via WhatsApp');
    }

    // 2. Salvar mensagem no banco
    const messageData: any = {
      id_da_conversacao: conversationId,
      texto_da_mensagem: message || caption || '',
      tipo_de_mensagem: messageType,
      direcao: 'outbound',
      sender_type: 'human',
      sender_user_id: userId,
      status: 'sent',
      carimbo_de_data_e_hora: new Date().toISOString(),
    };

    // Adicionar dados de mídia se existirem
    if (mediaUrl) {
      messageData.media_url = mediaUrl;
    }
    if (caption) {
      messageData.media_caption = caption;
    }
    if (filename) {
      messageData.media_filename = filename;
    }

    const { data: savedMessage, error: messageError } = await supabase
      .from('mensagens_do_whatsapp')
      .insert(messageData)
      .select()
      .single();

    if (messageError) throw messageError;

    // 3. Atualizar última mensagem da conversa
    const lastMessagePreview =
      messageType === 'text'
        ? message
        : messageType === 'image'
        ? '📷 Imagem'
        : messageType === 'audio'
        ? '🎤 Áudio'
        : '📎 Documento';

    const { error: conversationError } = await supabase
      .from('conversas_do_whatsapp')
      .update({
        ultima_mensagem: lastMessagePreview,
        hora_da_ultima_mensagem: new Date().toISOString(),
      })
      .eq('id', conversationId);

    if (conversationError) throw conversationError;

    // 4. Registrar log
    await supabase.from('system_logs').insert({
      company_id: companyId,
      type: 'user_action',
      severity: 'info',
      message: `Mensagem ${messageType} enviada para ${phoneNumber}`,
      metadata: {
        user_id: userId,
        conversation_id: conversationId,
        message_type: messageType,
        has_media: !!mediaUrl,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Mensagem enviada com sucesso',
      data: savedMessage,
    });
  } catch (error: any) {
    console.error('Error sending WhatsApp message:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Erro ao enviar mensagem' },
      { status: 500 }
    );
  }
}
