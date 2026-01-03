import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/chats/team
 * Listar membros da equipe com estatísticas de atendimento
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    if (!companyId) {
      return NextResponse.json(
        { success: false, message: 'companyId é obrigatório' },
        { status: 400 }
      );
    }

    // Buscar todos os usuários da empresa
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, name, email, is_active')
      .eq('company_id', parseInt(companyId))
      .eq('is_active', true)
      .order('name');

    if (usersError) {
      console.error('Error fetching users:', usersError);
      return NextResponse.json(
        { success: false, message: 'Erro ao buscar usuários', error: usersError.message },
        { status: 500 }
      );
    }

    // Para cada usuário, buscar estatísticas de atendimento
    const teamWithStats = await Promise.all(
      (users || []).map(async (user) => {
        // Contar chats atribuídos
        const { count: totalChats } = await supabase
          .from('conversas_do_whatsapp')
          .select('id', { count: 'exact', head: true })
          .eq('assigned_to', user.id);

        // Contar chats ativos (não resolvidos/fechados)
        const { count: activeChats } = await supabase
          .from('conversas_do_whatsapp')
          .select('id', { count: 'exact', head: true })
          .eq('assigned_to', user.id)
          .not('status_da_conversa', 'in', '(closed,resolved)');

        // Contar chats com mensagens não lidas
        const { count: unreadChats } = await supabase
          .from('conversas_do_whatsapp')
          .select('id', { count: 'exact', head: true })
          .eq('assigned_to', user.id)
          .gt('contagem_nao_lida', 0);

        return {
          ...user,
          stats: {
            totalChats: totalChats || 0,
            activeChats: activeChats || 0,
            unreadChats: unreadChats || 0,
          },
        };
      })
    );

    return NextResponse.json({
      success: true,
      team: teamWithStats,
    });
  } catch (error) {
    console.error('Error in GET /api/chats/team:', error);
    return NextResponse.json(
      { success: false, message: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
