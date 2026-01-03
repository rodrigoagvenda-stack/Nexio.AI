import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { messageId: string } }
) {
  try {
    const { messageId } = params;
    const { newMessage, companyId } = await request.json();

    if (!newMessage || !newMessage.trim()) {
      return NextResponse.json(
        { success: false, message: 'Mensagem não pode estar vazia' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Verificar se a mensagem existe e pertence à empresa
    const { data: message, error: fetchError } = await supabase
      .from('mensagens_do_whatsapp')
      .select('*')
      .eq('id', messageId)
      .eq('company_id', companyId)
      .single();

    if (fetchError || !message) {
      return NextResponse.json(
        { success: false, message: 'Mensagem não encontrada' },
        { status: 404 }
      );
    }

    // Atualizar mensagem
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
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      message: 'Mensagem editada com sucesso',
      data: updatedMessage,
    });
  } catch (error: any) {
    console.error('Error editing message:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Erro ao editar mensagem' },
      { status: 500 }
    );
  }
}
