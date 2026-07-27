import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/require-auth';

/**
 * GET /api/chats/assignments
 * Listar histórico de atribuições
 */
export async function GET(request: NextRequest) {
  const { context, error: authError } = await requireAuth(request);
  if (authError) return authError;

  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const chatId = searchParams.get('chatId');
    const assignedTo = searchParams.get('assignedTo');
    const limit = searchParams.get('limit') || '50';

    let query = supabase
      .from('chat_assignments')
      .select(`
        *,
        chat:conversas_do_whatsapp(id, nome_do_contato, numero_de_telefone),
        assigned_to_user:users!chat_assignments_assigned_to_fkey(id, name),
        assigned_from_user:users!chat_assignments_assigned_from_fkey(id, name),
        assigned_by_user:users!chat_assignments_assigned_by_fkey(id, name)
      `)
      .eq('company_id', context.companyId)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    // Filtrar por chat específico
    if (chatId) {
      query = query.eq('chat_id', parseInt(chatId));
    }

    // Filtrar por usuário atribuído
    if (assignedTo) {
      query = query.eq('assigned_to', parseInt(assignedTo));
    }

    const { data: assignments, error } = await query;

    if (error) {
      console.error('Error fetching assignments:', error);
      return NextResponse.json(
        { success: false, message: 'Erro ao buscar atribuições', error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      assignments: assignments || [],
    });
  } catch (error) {
    console.error('Error in GET /api/chats/assignments:', error);
    return NextResponse.json(
      { success: false, message: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
