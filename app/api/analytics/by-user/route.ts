import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/analytics/by-user
 * Retorna métricas de desempenho por usuário
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const userId = searchParams.get('userId'); // Opcional: filtrar por usuário específico

    if (!companyId) {
      return NextResponse.json(
        { success: false, message: 'companyId é obrigatório' },
        { status: 400 }
      );
    }

    let query = supabase
      .from('analytics_by_user')
      .select('*')
      .eq('company_id', parseInt(companyId))
      .order('messages_sent', { ascending: false });

    // Filtrar por usuário específico se fornecido
    if (userId) {
      query = query.eq('user_id', parseInt(userId));
    }

    const { data: userMetrics, error } = await query;

    if (error) {
      console.error('Error fetching user metrics:', error);
      return NextResponse.json(
        { success: false, message: 'Erro ao buscar métricas por usuário', error: error.message },
        { status: 500 }
      );
    }

    // Buscar tempo médio de resposta
    const { data: responseTime, error: rtError } = await supabase
      .from('analytics_response_time')
      .select('*')
      .eq('company_id', parseInt(companyId));

    if (rtError) {
      console.error('Error fetching response time:', rtError);
    }

    // Combinar dados
    const enrichedMetrics = (userMetrics || []).map((user) => {
      const rt = responseTime?.find((r) => r.user_id === user.user_id);
      return {
        ...user,
        avg_response_time_minutes: rt?.avg_response_time_minutes || null,
        median_response_time_minutes: rt?.median_response_time_minutes || null,
        total_responses: rt?.total_responses || 0,
      };
    });

    return NextResponse.json({
      success: true,
      users: enrichedMetrics,
    });
  } catch (error) {
    console.error('Error in GET /api/analytics/by-user:', error);
    return NextResponse.json(
      { success: false, message: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
