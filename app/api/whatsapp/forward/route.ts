import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/require-auth';

export async function POST(request: NextRequest) {
  const { context, error: authError } = await requireAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { messageId, conversationIds } = body;

    if (!messageId || !conversationIds?.length) {
      return NextResponse.json({ success: false, message: 'Dados obrigatórios faltando' }, { status: 400 });
    }

    const supabase = await createClient();

    const [
      { data: message, error: messageError },
      { data: company, error: companyError }
    ] = await Promise.all([
      supabase
        .from('mensagens_do_whatsapp')
        .select('texto_da_mensagem, tipo_de_mensagem, url_da_midia, whatsapp_message_id')
        .eq('id', messageId)
        .eq('company_id', context.companyId)
        .single(),
      supabase
        .from('companies')
        .select('whatsapp_instance, whatsapp_token')
        .eq('id', context.companyId)
        .single()
    ]);

    if (messageError || !message) {
      return NextResponse.json({ success: false, message: 'Mensagem não encontrada' }, { status: 404 });
    }

    if (companyError || !company?.whatsapp_instance || !company?.whatsapp_token) {
      return NextResponse.json({ success: false, message: 'Credenciais WhatsApp não configuradas' }, { status: 400 });
    }

    const { data: conversations, error: conversationsError } = await supabase
      .from('conversas_do_whatsapp')
      .select('id, numero_de_telefone')
      .in('id', conversationIds)
      .eq('company_id', context.companyId);

    if (conversationsError || !conversations?.length) {
      return NextResponse.json({ success: false, message: 'Conversas não encontradas' }, { status: 404 });
    }

    const results = await Promise.allSettled(
      conversations.map(async (conversation) => {
        let payload: any = { number: conversation.numero_de_telefone, text: message.texto_da_mensagem };
        let endpoint = 'message/sendText';

        if (message.url_da_midia) {
          switch (message.tipo_de_mensagem) {
            case 'image':
              endpoint = 'message/sendImage';
              payload = { number: conversation.numero_de_telefone, image: message.url_da_midia, caption: message.texto_da_mensagem };
              break;
            case 'video':
              endpoint = 'message/sendVideo';
              payload = { number: conversation.numero_de_telefone, video: message.url_da_midia, caption: message.texto_da_mensagem };
              break;
            case 'audio':
              endpoint = 'message/sendAudio';
              payload = { number: conversation.numero_de_telefone, audio: message.url_da_midia };
              break;
            case 'document':
              endpoint = 'message/sendDocument';
              payload = { number: conversation.numero_de_telefone, document: message.url_da_midia, caption: message.texto_da_mensagem };
              break;
          }
        }

        const response = await fetch(`${company.whatsapp_instance}/${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': company.whatsapp_token },
          body: JSON.stringify(payload),
        });

        if (!response.ok) throw new Error(`Erro ao encaminhar para ${conversation.numero_de_telefone}`);

        const result = await response.json();

        await supabase.from('mensagens_do_whatsapp').insert({
          company_id: context.companyId,
          id_da_conversacao: conversation.id,
          texto_da_mensagem: message.texto_da_mensagem,
          tipo_de_mensagem: message.tipo_de_mensagem,
          direcao: 'outbound',
          sender_type: 'human',
          sender_user_id: context.userId,
          status: 'sent',
          url_da_midia: message.url_da_midia,
          whatsapp_message_id: result.key?.id || result.id,
          carimbo_de_data_e_hora: new Date().toISOString(),
        });

        await supabase
          .from('conversas_do_whatsapp')
          .update({ ultima_mensagem: message.texto_da_mensagem, hora_da_ultima_mensagem: new Date().toISOString() })
          .eq('id', conversation.id)
          .eq('company_id', context.companyId);

        return { conversationId: conversation.id, success: true };
      })
    );

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
    return NextResponse.json({ success: false, message: error.message || 'Erro ao encaminhar mensagem' }, { status: 500 });
  }
}
