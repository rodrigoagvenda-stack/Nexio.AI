import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/chats/assign
 * Atribuir chat para um usuário
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { chatId, assignedTo, assignedBy, companyId, notes } = body;

    // Validações
    if (!chatId || !assignedTo || !assignedBy || !companyId) {
      return NextResponse.json(
        { success: false, message: 'Campos obrigatórios: chatId, assignedTo, assignedBy, companyId' },
        { status: 400 }
      );
    }

    // Verificar se chat existe e pertence à empresa
    const { data: chat, error: chatError } = await supabase
      .from('conversas_do_whatsapp')
      .select('id, assigned_to, company_id')
      .eq('id', chatId)
      .eq('company_id', companyId)
      .single();

    if (chatError || !chat) {
      return NextResponse.json(
        { success: false, message: 'Chat não encontrado' },
        { status: 404 }
      );
    }

    // Verificar se usuário de destino existe e pertence à empresa
    const { data: targetUser, error: userError } = await supabase
      .from('users')
      .select('id, name, company_id')
      .eq('id', assignedTo)
      .eq('company_id', companyId)
      .single();

    if (userError || !targetUser) {
      return NextResponse.json(
        { success: false, message: 'Usuário de destino não encontrado ou não pertence à empresa' },
        { status: 404 }
      );
    }

    const currentAssignedTo = chat.assigned_to;
    const actionType = currentAssignedTo ? 'transfer' : 'assign';

    // Atualizar o chat
    const { error: updateError } = await supabase
      .from('conversas_do_whatsapp')
      .update({
        assigned_to: assignedTo,
        assigned_at: new Date().toISOString(),
        assigned_by: assignedBy,
      })
      .eq('id', chatId)
      .eq('company_id', companyId);

    if (updateError) {
      console.error('Error updating chat assignment:', updateError);
      return NextResponse.json(
        { success: false, message: 'Erro ao atribuir chat', error: updateError.message },
        { status: 500 }
      );
    }

    // Registrar no histórico
    const { error: historyError } = await supabase
      .from('chat_assignments')
      .insert({
        chat_id: chatId,
        company_id: companyId,
        assigned_to: assignedTo,
        assigned_from: currentAssignedTo,
        assigned_by: assignedBy,
        action_type: actionType,
        notes: notes || null,
      });

    if (historyError) {
      console.error('Error creating assignment history:', historyError);
      // Não falhar a operação se apenas o histórico falhar
    }

    return NextResponse.json({
      success: true,
      message: actionType === 'transfer' ? 'Chat transferido com sucesso' : 'Chat atribuído com sucesso',
      assignment: {
        chatId,
        assignedTo,
        assignedToName: targetUser.name,
        actionType,
      },
    });
  } catch (error) {
    console.error('Error in POST /api/chats/assign:', error);
    return NextResponse.json(
      { success: false, message: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/chats/assign
 * Desatribuir chat (remover atribuição)
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const chatId = searchParams.get('chatId');
    const userId = searchParams.get('userId');
    const companyId = searchParams.get('companyId');

    // Validações
    if (!chatId || !userId || !companyId) {
      return NextResponse.json(
        { success: false, message: 'Parâmetros obrigatórios: chatId, userId, companyId' },
        { status: 400 }
      );
    }

    // Verificar se chat existe
    const { data: chat } = await supabase
      .from('conversas_do_whatsapp')
      .select('id, assigned_to')
      .eq('id', parseInt(chatId))
      .eq('company_id', parseInt(companyId))
      .single();

    if (!chat) {
      return NextResponse.json(
        { success: false, message: 'Chat não encontrado' },
        { status: 404 }
      );
    }

    const previousAssignedTo = chat.assigned_to;

    // Remover atribuição
    const { error: updateError } = await supabase
      .from('conversas_do_whatsapp')
      .update({
        assigned_to: null,
        assigned_at: null,
        assigned_by: null,
      })
      .eq('id', parseInt(chatId))
      .eq('company_id', parseInt(companyId));

    if (updateError) {
      console.error('Error removing chat assignment:', updateError);
      return NextResponse.json(
        { success: false, message: 'Erro ao desatribuir chat', error: updateError.message },
        { status: 500 }
      );
    }

    // Registrar no histórico
    const { error: historyError } = await supabase
      .from('chat_assignments')
      .insert({
        chat_id: parseInt(chatId),
        company_id: parseInt(companyId),
        assigned_to: null,
        assigned_from: previousAssignedTo,
        assigned_by: parseInt(userId),
        action_type: 'unassign',
        notes: 'Chat desatribuído',
      });

    if (historyError) {
      console.error('Error creating unassignment history:', historyError);
    }

    return NextResponse.json({
      success: true,
      message: 'Chat desatribuído com sucesso',
    });
  } catch (error) {
    console.error('Error in DELETE /api/chats/assign:', error);
    return NextResponse.json(
      { success: false, message: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
