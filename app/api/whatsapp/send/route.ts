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

    // 3. Enviar mensagem via n8n/WhatsApp
    const whatsappResult = await sendWhatsAppMessage({
      number: phoneNumber,
      text: message,
      company_id: parseInt(companyId),
      instance_name: company.whatsapp_instance,
      instance_token: company.whatsapp_token,
      conversa_id: conversationId.toString(),
      lead_id: '',
      message_id: '',
    });

    if (!whatsappResult.success) {
      throw new Error('Erro ao enviar mensagem via WhatsApp');
    }

    // 4. Salvar mensagem no banco
    const { data: savedMessage, error: messageError } = await supabase
      .from('mensagens_do_whatsapp')
      .insert({
        company_id: companyId, // 🔒 Segurança: isolamento por empresa
        id_da_conversacao: conversationId,
        texto_da_mensagem: message,
        tipo_de_mensagem: 'text',
        direcao: 'outbound',
        sender_type: 'human',
        sender_user_id: userId,
        status: 'sent',
        carimbo_de_data_e_hora: new Date().toISOString(),
      })
      .select()
      .single();

    if (messageError) throw messageError;

    // 5. Atualizar última mensagem da conversa
    const { error: conversationError } = await supabase
      .from('conversas_do_whatsapp')
      .update({
        ultima_mensagem: message,
        hora_da_ultima_mensagem: new Date().toISOString(),
      })
      .eq('id', conversationId)
      .eq('company_id', companyId); // 🔒 Segurança: garante isolamento

    if (conversationError) throw conversationError;

    // 6. Registrar log
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
