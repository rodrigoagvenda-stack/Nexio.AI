import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/analytics/overview
 * Retorna métricas gerais de atendimento da empresa
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

    // Buscar métricas gerais da view
    const { data: overview, error: overviewError } = await supabase
      .from('analytics_overview')
      .select('*')
      .eq('company_id', parseInt(companyId))
      .single();

    if (overviewError) {
      console.error('Error fetching overview:', overviewError);
      return NextResponse.json(
        { success: false, message: 'Erro ao buscar métricas gerais', error: overviewError.message },
        { status: 500 }
      );
    }

    // Buscar top leads
    const { data: topLeads, error: topLeadsError } = await supabase
      .from('analytics_top_leads')
      .select('*')
      .eq('company_id', parseInt(companyId))
      .limit(10);

    if (topLeadsError) {
      console.error('Error fetching top leads:', topLeadsError);
    }

    // Buscar métricas diárias (últimos 7 dias)
    const { data: daily, error: dailyError } = await supabase
      .from('analytics_daily')
      .select('*')
      .eq('company_id', parseInt(companyId))
      .limit(7);

    if (dailyError) {
      console.error('Error fetching daily metrics:', dailyError);
    }

    return NextResponse.json({
      success: true,
      overview: overview || {},
      topLeads: topLeads || [],
      dailyMetrics: daily || [],
    });
  } catch (error) {
    console.error('Error in GET /api/analytics/overview:', error);
    return NextResponse.json(
      { success: false, message: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
