import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: { messageId: string } }
) {
  try {
    const { messageId } = params;
    const { emoji, userId, companyId } = await request.json();

    if (!emoji) {
      return NextResponse.json(
        { success: false, message: 'Emoji não informado' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Buscar mensagem
    const { data: message, error: fetchError } = await supabase
      .from('mensagens_do_whatsapp')
      .select('reactions')
      .eq('id', messageId)
      .eq('company_id', companyId)
      .single();

    if (fetchError || !message) {
      return NextResponse.json(
        { success: false, message: 'Mensagem não encontrada' },
        { status: 404 }
      );
    }

    // Parse reactions existentes
    let reactions = Array.isArray(message.reactions) ? message.reactions : [];

    // Verificar se usuário já reagiu com este emoji
    const existingReactionIndex = reactions.findIndex(
      (r: any) => r.user_id === userId && r.emoji === emoji
    );

    if (existingReactionIndex >= 0) {
      // Remover reação (toggle)
      reactions.splice(existingReactionIndex, 1);
    } else {
      // Adicionar nova reação
      reactions.push({
        emoji,
        user_id: userId,
        created_at: new Date().toISOString(),
      });
    }

    // Atualizar no banco
    const { data: updatedMessage, error: updateError } = await supabase
      .from('mensagens_do_whatsapp')
      .update({ reactions })
      .eq('id', messageId)
      .eq('company_id', companyId)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      message: 'Reação atualizada com sucesso',
      data: updatedMessage,
    });
  } catch (error: any) {
    console.error('Error reacting to message:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Erro ao reagir à mensagem' },
      { status: 500 }
    );
  }
}
