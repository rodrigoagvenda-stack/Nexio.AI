import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messageId, emoji, companyId } = body;

    if (!messageId || !emoji || !companyId) {
      return NextResponse.json(
        { success: false, message: 'Dados obrigatórios faltando' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // 1. Buscar mensagem e credenciais WhatsApp
    const [
      { data: message, error: messageError },
      { data: company, error: companyError }
    ] = await Promise.all([
      supabase
        .from('mensagens_do_whatsapp')
        .select('id, id_da_conversacao, whatsapp_message_id')
        .eq('id', messageId)
        .eq('company_id', companyId)
        .single(),
      supabase
        .from('companies')
        .select('whatsapp_instance, whatsapp_token')
        .eq('id', companyId)
        .single()
    ]);

    if (messageError || !message) {
      return NextResponse.json(
        { success: false, message: 'Mensagem não encontrada' },
        { status: 404 }
      );
    }

    if (companyError || !company?.whatsapp_instance || !company?.whatsapp_token) {
      return NextResponse.json(
        { success: false, message: 'Credenciais WhatsApp não configuradas' },
        { status: 400 }
      );
    }

    // 2. Buscar conversa para pegar o número de telefone
    const { data: conversation } = await supabase
      .from('conversas_do_whatsapp')
      .select('numero_de_telefone')
      .eq('id', message.id_da_conversacao)
      .single();

    if (!conversation) {
      return NextResponse.json(
        { success: false, message: 'Conversa não encontrada' },
        { status: 404 }
      );
    }

    // 3. Enviar reação via UAZapi
    const uazapiUrl = `${company.whatsapp_instance}/message/sendReaction`;

    const response = await fetch(uazapiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': company.whatsapp_token,
      },
      body: JSON.stringify({
        number: conversation.numero_de_telefone,
        key: {
          id: message.whatsapp_message_id,
        },
        reaction: emoji,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[UAZapi] Erro ao enviar reação:', errorText);
      throw new Error('Erro ao enviar reação via WhatsApp');
    }

    return NextResponse.json({
      success: true,
      message: 'Reação enviada com sucesso',
    });
  } catch (error: any) {
    console.error('Error sending reaction:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Erro ao enviar reação' },
      { status: 500 }
    );
  }
}
