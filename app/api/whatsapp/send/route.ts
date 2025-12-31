import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendWhatsAppMessage } from '@/lib/n8n/client';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { conversationId, phoneNumber, message, companyId, userId } = body;

    if (!conversationId || !phoneNumber || !message || !companyId) {
      return NextResponse.json(
        { success: false, message: 'Dados obrigatórios faltando' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // 1. Paralelizar queries iniciais (conversa + company) para reduzir latência
    const [
      { data: conversation, error: convCheckError },
      { data: company, error: companyError }
    ] = await Promise.all([
      // Buscar conversa com lead_id (2 queries em 1)
      supabase
        .from('conversas_do_whatsapp')
        .select('id, company_id, id_do_lead')
        .eq('id', conversationId)
        .eq('company_id', companyId)
        .single(),
      // Buscar credenciais WhatsApp da empresa
      supabase
        .from('companies')
        .select('whatsapp_instance, whatsapp_token')
        .eq('id', companyId)
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

    const leadId = conversation.id_do_lead || null;

    // 4. Enviar mensagem via n8n/WhatsApp
    const whatsappResult = await sendWhatsAppMessage({
      number: phoneNumber,
      text: message,
      messageType: 'text',
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

    // 5. Preparar dados da mensagem
    const messageData: any = {
      company_id: companyId, // 🔒 Segurança: isolamento por empresa
      id_da_conversacao: conversationId,
      texto_da_mensagem: message,
      tipo_de_mensagem: 'text',
      direcao: 'outbound',
      sender_type: 'human',
      sender_user_id: userId,
      status: 'sent',
      carimbo_de_data_e_hora: new Date().toISOString(),
    };

    // Adicionar lead_id apenas se existir (nem todas conversas têm lead)
    if (leadId) {
      messageData.id_do_lead = leadId;
    }

    // 6. Paralelizar: salvar mensagem + atualizar conversa (reduz latência)
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
        .eq('company_id', companyId) // 🔒 Segurança: garante isolamento
    ]);

    if (messageError) throw messageError;
    if (conversationError) throw conversationError;

    // 7. Registrar log de forma assíncrona (não bloqueia resposta)
    supabase.from('system_logs').insert({
      company_id: companyId,
      type: 'user_action',
      severity: 'info',
      message: `Mensagem enviada para ${phoneNumber}`,
      metadata: {
        user_id: userId,
        conversation_id: conversationId,
        message_length: message.length,
      },
    }).catch(err => console.error('Error logging message send:', err));

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
