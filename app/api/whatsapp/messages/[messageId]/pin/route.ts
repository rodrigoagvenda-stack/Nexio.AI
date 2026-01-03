import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { messageId: string } }
) {
  try {
    const { messageId } = params;
    const { isPinned, companyId } = await request.json();

    const supabase = await createClient();

    // Atualizar status de fixação
    const { data: updatedMessage, error: updateError } = await supabase
      .from('mensagens_do_whatsapp')
      .update({ is_pinned: isPinned })
      .eq('id', messageId)
      .eq('company_id', companyId)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      message: isPinned ? 'Mensagem fixada com sucesso' : 'Mensagem desafixada com sucesso',
      data: updatedMessage,
    });
  } catch (error: any) {
    console.error('Error pinning message:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Erro ao fixar mensagem' },
      { status: 500 }
    );
  }
}
