// Depreciado: sistema antigo baseado em users/assigned_to. O botão "Transferir"
// do Atendimento usa /api/conversations/[id]/assign e /transfer (attendants/
// current_attendant_id) desde a unificação da máquina de vendas. Mantido sem
// remoção só por segurança, sem novo código deve depender destas rotas.
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/require-auth';

export async function POST(request: NextRequest) {
  const { context, error: authError } = await requireAuth(request);
  if (authError) return authError;

  try {
    const supabase = await createClient();
    const body = await request.json();
    const { chatId, assignedTo, assignedBy, notes } = body;

    if (!chatId || !assignedTo || !assignedBy) {
      return NextResponse.json(
        { success: false, message: 'Campos obrigatórios: chatId, assignedTo, assignedBy' },
        { status: 400 }
      );
    }

    const { data: chat, error: chatError } = await supabase
      .from('conversas_do_whatsapp')
      .select('id, assigned_to, company_id')
      .eq('id', chatId)
      .eq('company_id', context.companyId)
      .single();

    if (chatError || !chat) {
      return NextResponse.json({ success: false, message: 'Chat não encontrado' }, { status: 404 });
    }

    const { data: targetUser, error: userError } = await supabase
      .from('users')
      .select('id, name, company_id')
      .eq('id', assignedTo)
      .eq('company_id', context.companyId)
      .single();

    if (userError || !targetUser) {
      return NextResponse.json(
        { success: false, message: 'Usuário de destino não encontrado ou não pertence à empresa' },
        { status: 404 }
      );
    }

    const currentAssignedTo = chat.assigned_to;
    const actionType = currentAssignedTo ? 'transfer' : 'assign';

    const { error: updateError } = await supabase
      .from('conversas_do_whatsapp')
      .update({ assigned_to: assignedTo, assigned_at: new Date().toISOString(), assigned_by: assignedBy })
      .eq('id', chatId)
      .eq('company_id', context.companyId);

    if (updateError) {
      return NextResponse.json({ success: false, message: 'Erro ao atribuir chat' }, { status: 500 });
    }

    await supabase.from('chat_assignments').insert({
      chat_id: chatId,
      company_id: context.companyId,
      assigned_to: assignedTo,
      assigned_from: currentAssignedTo,
      assigned_by: assignedBy,
      action_type: actionType,
      notes: notes || null,
    });

    return NextResponse.json({
      success: true,
      message: actionType === 'transfer' ? 'Chat transferido com sucesso' : 'Chat atribuído com sucesso',
      assignment: { chatId, assignedTo, assignedToName: targetUser.name, actionType },
    });
  } catch (error) {
    console.error('Error in POST /api/chats/assign:', error);
    return NextResponse.json({ success: false, message: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const { context, error: authError } = await requireAuth(request);
  if (authError) return authError;

  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const chatId = searchParams.get('chatId');
    const userId = searchParams.get('userId');

    if (!chatId || !userId) {
      return NextResponse.json(
        { success: false, message: 'Parâmetros obrigatórios: chatId, userId' },
        { status: 400 }
      );
    }

    const { data: chat } = await supabase
      .from('conversas_do_whatsapp')
      .select('id, assigned_to')
      .eq('id', parseInt(chatId))
      .eq('company_id', context.companyId)
      .single();

    if (!chat) {
      return NextResponse.json({ success: false, message: 'Chat não encontrado' }, { status: 404 });
    }

    const { error: updateError } = await supabase
      .from('conversas_do_whatsapp')
      .update({ assigned_to: null, assigned_at: null, assigned_by: null })
      .eq('id', parseInt(chatId))
      .eq('company_id', context.companyId);

    if (updateError) {
      return NextResponse.json({ success: false, message: 'Erro ao desatribuir chat' }, { status: 500 });
    }

    await supabase.from('chat_assignments').insert({
      chat_id: parseInt(chatId),
      company_id: context.companyId,
      assigned_to: null,
      assigned_from: chat.assigned_to,
      assigned_by: parseInt(userId),
      action_type: 'unassign',
      notes: 'Chat desatribuído',
    });

    return NextResponse.json({ success: true, message: 'Chat desatribuído com sucesso' });
  } catch (error) {
    console.error('Error in DELETE /api/chats/assign:', error);
    return NextResponse.json({ success: false, message: 'Erro interno do servidor' }, { status: 500 });
  }
}
