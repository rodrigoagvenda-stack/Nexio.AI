import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { messageId: string } }
) {
  try {
    const { messageId } = params;
    const { isPinned, companyId } = await req.json();

    if (typeof isPinned !== 'boolean') {
      return NextResponse.json(
        { success: false, message: 'isPinned deve ser um boolean' },
        { status: 400 }
      );
    }

    if (!companyId) {
      return NextResponse.json(
        { success: false, message: 'Company ID é obrigatório' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // 1. Se está fixando, desafixar outras mensagens da mesma conversa primeiro (max 1 fixada)
    if (isPinned) {
      // Buscar a conversa da mensagem
      const { data: message } = await supabase
        .from('mensagens_do_whatsapp')
        .select('id_da_conversacao')
        .eq('id', messageId)
        .eq('company_id', companyId)
        .single();

      if (message?.id_da_conversacao) {
        // Desafixar outras mensagens da mesma conversa
        await supabase
          .from('mensagens_do_whatsapp')
          .update({ is_pinned: false })
          .eq('id_da_conversacao', message.id_da_conversacao)
          .eq('company_id', companyId)
          .eq('is_pinned', true);
      }
    }

    // 2. Atualizar status de fixação da mensagem
    const { data: updatedMessage, error: updateError } = await supabase
      .from('mensagens_do_whatsapp')
      .update({ is_pinned: isPinned })
      .eq('id', messageId)
      .eq('company_id', companyId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating pin status:', updateError);
      return NextResponse.json(
        { success: false, message: 'Erro ao fixar mensagem' },
        { status: 500 }
      );
    }

    // 3. Buscar credentials da empresa para chamar UAZapi
    const { data: company } = await supabase
      .from('companies')
      .select('whatsapp_instance, whatsapp_token')
      .eq('id', companyId)
      .single();

    // 4. Fixar/desfixar no WhatsApp via UAZapi (se disponível)
    if (company?.whatsapp_instance && company?.whatsapp_token && updatedMessage.id_externo) {
      try {
        const endpoint = isPinned ? '/message/pin' : '/message/unpin';
        const uazapiResponse = await fetch(
          `${company.whatsapp_instance}${endpoint}`,
          {
            method: 'POST',
            headers: {
              'apikey': company.whatsapp_token,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messageId: updatedMessage.id_externo,
            }),
          }
        );

        if (!uazapiResponse.ok) {
          console.error('UAZapi pin error:', await uazapiResponse.text());
        }
      } catch (error) {
        console.error('Error calling UAZapi to pin message:', error);
        // Não retornar erro, pois o banco já foi atualizado
      }
    }

    return NextResponse.json({
      success: true,
      message: isPinned ? 'Mensagem fixada com sucesso' : 'Mensagem desafixada com sucesso',
      data: updatedMessage,
    });
  } catch (error) {
    console.error('Error in pin message endpoint:', error);
    return NextResponse.json(
      { success: false, message: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
