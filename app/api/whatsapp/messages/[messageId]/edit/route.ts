import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { messageId: string } }
) {
  try {
    const { messageId } = params;
    const { newMessage, companyId } = await req.json();

    if (!newMessage?.trim()) {
      return NextResponse.json(
        { success: false, message: 'Mensagem não pode estar vazia' },
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

    // 1. Buscar credentials da empresa
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('whatsapp_instance, whatsapp_token')
      .eq('id', companyId)
      .single();

    if (companyError || !company) {
      return NextResponse.json(
        { success: false, message: 'Empresa não encontrada' },
        { status: 404 }
      );
    }

    // 2. Buscar a mensagem para validar e pegar ID externo do WhatsApp
    const { data: message, error: messageError } = await supabase
      .from('mensagens_do_whatsapp')
      .select('*')
      .eq('id', messageId)
      .eq('company_id', companyId)
      .single();

    if (messageError || !message) {
      return NextResponse.json(
        { success: false, message: 'Mensagem não encontrada' },
        { status: 404 }
      );
    }

    // 3. Validar se é mensagem própria (outbound)
    if (message.direcao !== 'outbound') {
      return NextResponse.json(
        { success: false, message: 'Só é possível editar mensagens enviadas por você' },
        { status: 403 }
      );
    }

    // 4. Editar mensagem via UAZapi (se tiver id_externo)
    if (message.id_externo && company.whatsapp_instance && company.whatsapp_token) {
      try {
        const uazapiResponse = await fetch(
          `${company.whatsapp_instance}/message/edit`,
          {
            method: 'PUT',
            headers: {
              'apikey': company.whatsapp_token,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messageId: message.id_externo,
              newText: newMessage.trim(),
            }),
          }
        );

        if (!uazapiResponse.ok) {
          console.error('UAZapi edit error:', await uazapiResponse.text());
        }
      } catch (error) {
        console.error('Error calling UAZapi to edit message:', error);
        // Não retornar erro aqui, pois ainda vamos atualizar no banco
      }
    }

    // 5. Atualizar mensagem no banco de dados
    const { data: updatedMessage, error: updateError } = await supabase
      .from('mensagens_do_whatsapp')
      .update({
        texto_da_mensagem: newMessage.trim(),
        is_edited: true,
        edited_at: new Date().toISOString(),
      })
      .eq('id', messageId)
      .eq('company_id', companyId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating message:', updateError);
      return NextResponse.json(
        { success: false, message: 'Erro ao atualizar mensagem' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Mensagem editada com sucesso',
      data: updatedMessage,
    });
  } catch (error) {
    console.error('Error in edit message endpoint:', error);
    return NextResponse.json(
      { success: false, message: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
