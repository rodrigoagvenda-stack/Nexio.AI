import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/analytics/by-period
 * Retorna métricas detalhadas para um período específico
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const period = searchParams.get('period') || '7d'; // 7d, 30d, 90d

    if (!companyId) {
      return NextResponse.json(
        { success: false, message: 'companyId é obrigatório' },
        { status: 400 }
      );
    }

    // Calcular datas com base no período se não fornecidas
    let start = startDate;
    let end = endDate || new Date().toISOString();

    if (!start) {
      const daysAgo = period === '7d' ? 7 : period === '30d' ? 30 : 90;
      const date = new Date();
      date.setDate(date.getDate() - daysAgo);
      start = date.toISOString();
    }

    // Buscar métricas diárias do período
    const { data: dailyMetrics, error } = await supabase
      .from('analytics_daily')
      .select('*')
      .eq('company_id', parseInt(companyId))
      .gte('date', start.split('T')[0])
      .lte('date', end.split('T')[0])
      .order('date', { ascending: true });

    if (error) {
      console.error('Error fetching period metrics:', error);
      return NextResponse.json(
        { success: false, message: 'Erro ao buscar métricas do período', error: error.message },
        { status: 500 }
      );
    }

    // Calcular totais do período
    const totals = {
      total_chats: dailyMetrics?.reduce((sum, d) => sum + (d.total_chats || 0), 0) || 0,
      total_messages: dailyMetrics?.reduce((sum, d) => sum + (d.total_messages || 0), 0) || 0,
      received_messages: dailyMetrics?.reduce((sum, d) => sum + (d.received_messages || 0), 0) || 0,
      sent_messages: dailyMetrics?.reduce((sum, d) => sum + (d.sent_messages || 0), 0) || 0,
      avg_messages_per_day: dailyMetrics?.length
        ? Math.round((dailyMetrics.reduce((sum, d) => sum + (d.total_messages || 0), 0) || 0) / dailyMetrics.length)
        : 0,
    };

    return NextResponse.json({
      success: true,
      period: {
        start,
        end,
        days: dailyMetrics?.length || 0,
      },
      totals,
      daily: dailyMetrics || [],
    });
  } catch (error) {
    console.error('Error in GET /api/analytics/by-period:', error);
    return NextResponse.json(
      { success: false, message: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
