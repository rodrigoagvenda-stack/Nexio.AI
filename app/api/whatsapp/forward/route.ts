import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messageId, conversationIds, companyId, userId } = body;

    if (!messageId || !conversationIds?.length || !companyId || !userId) {
      return NextResponse.json(
        { success: false, message: 'Dados obrigatórios faltando' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // 1. Buscar mensagem original e credenciais WhatsApp
    const [
      { data: message, error: messageError },
      { data: company, error: companyError }
    ] = await Promise.all([
      supabase
        .from('mensagens_do_whatsapp')
        .select('texto_da_mensagem, tipo_de_mensagem, url_da_midia, whatsapp_message_id')
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

    // 2. Buscar conversas de destino
    const { data: conversations, error: conversationsError } = await supabase
      .from('conversas_do_whatsapp')
      .select('id, numero_de_telefone')
      .in('id', conversationIds)
      .eq('company_id', companyId);

    if (conversationsError || !conversations?.length) {
      return NextResponse.json(
        { success: false, message: 'Conversas não encontradas' },
        { status: 404 }
      );
    }

    // 3. Encaminhar para cada conversa
    const results = await Promise.allSettled(
      conversations.map(async (conversation) => {
        // Preparar payload baseado no tipo de mensagem
        let payload: any = {
          number: conversation.numero_de_telefone,
          text: message.texto_da_mensagem,
        };

        let endpoint = 'message/sendText';

        // Se tem mídia, adaptar o endpoint e payload
        if (message.url_da_midia) {
          switch (message.tipo_de_mensagem) {
            case 'image':
              endpoint = 'message/sendImage';
              payload = {
                number: conversation.numero_de_telefone,
                image: message.url_da_midia,
                caption: message.texto_da_mensagem,
              };
              break;
            case 'video':
              endpoint = 'message/sendVideo';
              payload = {
                number: conversation.numero_de_telefone,
                video: message.url_da_midia,
                caption: message.texto_da_mensagem,
              };
              break;
            case 'audio':
              endpoint = 'message/sendAudio';
              payload = {
                number: conversation.numero_de_telefone,
                audio: message.url_da_midia,
              };
              break;
            case 'document':
              endpoint = 'message/sendDocument';
              payload = {
                number: conversation.numero_de_telefone,
                document: message.url_da_midia,
                caption: message.texto_da_mensagem,
              };
              break;
          }
        }

        // Enviar via UAZapi
        const uazapiUrl = `${company.whatsapp_instance}/${endpoint}`;
        const response = await fetch(uazapiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': company.whatsapp_token,
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[UAZapi] Erro ao encaminhar para ${conversation.numero_de_telefone}:`, errorText);
          throw new Error(`Erro ao encaminhar para ${conversation.numero_de_telefone}`);
        }

        const result = await response.json();

        // Salvar mensagem encaminhada no banco
        const { error: insertError } = await supabase
          .from('mensagens_do_whatsapp')
          .insert({
            company_id: companyId,
            id_da_conversacao: conversation.id,
            texto_da_mensagem: message.texto_da_mensagem,
            tipo_de_mensagem: message.tipo_de_mensagem,
            direcao: 'outbound',
            sender_type: 'human',
            sender_user_id: userId,
            status: 'sent',
            url_da_midia: message.url_da_midia,
            whatsapp_message_id: result.key?.id || result.id,
            carimbo_de_data_e_hora: new Date().toISOString(),
          });

        if (insertError) {
          console.error('Error saving forwarded message:', insertError);
        }

        // Atualizar última mensagem da conversa
        await supabase
          .from('conversas_do_whatsapp')
          .update({
            ultima_mensagem: message.texto_da_mensagem,
            hora_da_ultima_mensagem: new Date().toISOString(),
          })
          .eq('id', conversation.id)
          .eq('company_id', companyId);

        return { conversationId: conversation.id, success: true };
      })
    );

    // 4. Contar sucessos e falhas
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    return NextResponse.json({
      success: true,
      message: failed > 0
        ? `Mensagem encaminhada para ${successful} de ${results.length} contatos`
        : `Mensagem encaminhada com sucesso para ${successful} contatos`,
      stats: { successful, failed, total: results.length },
    });
  } catch (error: any) {
    console.error('Error forwarding message:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Erro ao encaminhar mensagem' },
      { status: 500 }
    );
  }
}
