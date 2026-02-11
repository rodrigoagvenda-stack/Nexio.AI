import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendWhatsAppMessage } from '@/lib/n8n/client';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { conversationId, phoneNumber, message, companyId, userId, messageType, mediaUrl, caption, filename } = body;

    if (!conversationId || !phoneNumber || !companyId) {
      return NextResponse.json(
        { success: false, message: 'Dados obrigatórios faltando' },
        { status: 400 }
      );
    }

    // Validação específica por tipo de mensagem
    const type = messageType || 'text';
    if (type === 'text' && !message) {
      return NextResponse.json(
        { success: false, message: 'Mensagem de texto não pode estar vazia' },
        { status: 400 }
      );
    }
    if (type !== 'text' && !mediaUrl) {
      return NextResponse.json(
        { success: false, message: 'URL da mídia é obrigatória' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // 1. Paralelizar queries iniciais (conversa + company + webhook config)
    const [
      { data: conversation, error: convCheckError },
      { data: company, error: companyError },
      { data: webhookConfig, error: webhookError }
    ] = await Promise.all([
      supabase
        .from('conversas_do_whatsapp')
        .select('id, company_id, id_do_lead')
        .eq('id', conversationId)
        .eq('company_id', companyId)
        .single(),
      supabase
        .from('companies')
        .select('whatsapp_instance, whatsapp_token')
        .eq('id', companyId)
        .single(),
      supabase
        .from('n8n_webhook_config')
        .select('webhook_url, auth_type, auth_username, auth_password, auth_token')
        .eq('webhook_type', 'whatsapp')
        .eq('is_active', true)
        .single()
    ]);

    // Validações de segurança
    if (convCheckError || !conversation) {
      return NextResponse.json(
        { success: false, message: 'Conversa não encontrada ou acesso negado' },
        { status: 403 }
      );
    }

    if (companyError || !company?.whatsapp_instance || !company?.whatsapp_token) {
      return NextResponse.json(
        { success: false, message: 'Credenciais WhatsApp não configuradas' },
        { status: 400 }
      );
    }

    if (webhookError || !webhookConfig?.webhook_url) {
      return NextResponse.json(
        { success: false, message: 'Webhook WhatsApp não configurado. Configure em Admin > Webhooks & APIs.' },
        { status: 400 }
      );
    }

    const leadId = conversation.id_do_lead || null;

    // 2. Preparar dados da mensagem
    const messageData: any = {
      company_id: companyId,
      id_da_conversacao: conversationId,
      texto_da_mensagem: message || (type === 'image' ? '📷 Imagem' : type === 'document' ? '📄 Documento' : type === 'audio' ? '🎵 Áudio' : type === 'video' ? '🎥 Vídeo' : ''),
      tipo_de_mensagem: type,
      direcao: 'outbound',
      sender_type: 'human',
      sender_user_id: userId,
      status: 'sent',
      carimbo_de_data_e_hora: new Date().toISOString(),
      url_da_midia: mediaUrl || null,
    };

    if (leadId) {
      messageData.id_do_lead = leadId;
    }

    // 3. Salvar mensagem + atualizar conversa em paralelo (ANTES do n8n)
    const [
      { data: savedMessage, error: messageError },
      { error: conversationError }
    ] = await Promise.all([
      supabase
        .from('mensagens_do_whatsapp')
        .insert(messageData)
        .select()
        .single(),
      supabase
        .from('conversas_do_whatsapp')
        .update({
          ultima_mensagem: message,
          hora_da_ultima_mensagem: new Date().toISOString(),
        })
        .eq('id', conversationId)
        .eq('company_id', companyId)
    ]);

    if (messageError) throw messageError;
    if (conversationError) throw conversationError;

    // 4. Disparar n8n em background (fire-and-forget) — não bloqueia a resposta
    sendWhatsAppMessage(
      {
        number: phoneNumber,
        text: message || '',
        messageType: type,
        mediaUrl: mediaUrl || '',
        caption: caption || '',
        filename: filename || '',
        company_id: parseInt(companyId),
        url_instancia: company.whatsapp_instance,
        token: company.whatsapp_token,
        conversa_id: conversationId.toString(),
        lead_id: leadId ? leadId.toString() : '',
        message_id: savedMessage.id?.toString() || '',
      },
      webhookConfig
    ).catch((err) => {
      console.error('Error sending via n8n (background):', err);
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
