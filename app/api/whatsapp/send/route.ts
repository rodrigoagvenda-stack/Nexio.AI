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

    // 1. Verificar se conversa pertence à empresa (segurança) - DEVE SER PRIMEIRO!
    const { data: conversation, error: convCheckError } = await supabase
      .from('conversas_do_whatsapp')
      .select('id, company_id')
      .eq('id', conversationId)
      .eq('company_id', companyId)
      .single();

    if (convCheckError || !conversation) {
      return NextResponse.json(
        { success: false, message: 'Conversa não encontrada ou acesso negado' },
        { status: 403 }
      );
    }

    // 2. Buscar credenciais da empresa para WhatsApp
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('whatsapp_instance, whatsapp_token')
      .eq('id', companyId)
      .single();

    if (companyError || !company?.whatsapp_instance || !company?.whatsapp_token) {
      return NextResponse.json(
        { success: false, message: 'Credenciais WhatsApp não configuradas' },
        { status: 400 }
      );
    }

    // 3. Buscar lead associado à conversa (se houver)
    const { data: conversationData } = await supabase
      .from('conversas_do_whatsapp')
      .select('id_do_lead')
      .eq('id', conversationId)
      .single();

    const leadId = conversationData?.id_do_lead || null;

    // 4. Enviar mensagem via n8n/WhatsApp
    const whatsappResult = await sendWhatsAppMessage({
      number: phoneNumber,
      text: message || '',
      messageType: type,
      mediaUrl: mediaUrl || '',
      caption: caption || '',
      filename: filename || '',
      company_id: parseInt(companyId),
      url_instancia: company.whatsapp_instance, // URL base da instância UAZapi
      token: company.whatsapp_token, // Token de autenticação
      conversa_id: conversationId.toString(),
      lead_id: leadId ? leadId.toString() : '',
      message_id: '',
    });

    if (!whatsappResult.success) {
      throw new Error('Erro ao enviar mensagem via WhatsApp');
    }

    // 5. Salvar mensagem no banco
    const messageData: any = {
      company_id: companyId, // 🔒 Segurança: isolamento por empresa
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

    // Adicionar lead_id apenas se existir (nem todas conversas têm lead)
    if (leadId) {
      messageData.id_do_lead = leadId;
    }

    const { data: savedMessage, error: messageError } = await supabase
      .from('mensagens_do_whatsapp')
      .insert(messageData)
      .select()
      .single();

    if (messageError) throw messageError;

    // 6. Atualizar última mensagem da conversa
    const { error: conversationError } = await supabase
      .from('conversas_do_whatsapp')
      .update({
        ultima_mensagem: message,
        hora_da_ultima_mensagem: new Date().toISOString(),
      })
      .eq('id', conversationId)
      .eq('company_id', companyId); // 🔒 Segurança: garante isolamento

    if (conversationError) throw conversationError;

    // 7. Registrar log
    await supabase.from('system_logs').insert({
      company_id: companyId,
      type: 'user_action',
      severity: 'info',
      message: `Mensagem enviada para ${phoneNumber}`,
      metadata: {
        user_id: userId,
        conversation_id: conversationId,
        message_length: message.length,
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
