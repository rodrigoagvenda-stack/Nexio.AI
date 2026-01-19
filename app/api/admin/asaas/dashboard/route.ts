import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET /api/admin/asaas/dashboard
export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const { data: adminUser } = await supabase
      .from('admin_users')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (!adminUser) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    // Total de cobranças
    const { count: totalCobrancas } = await supabase
      .from('asaas_cobrancas')
      .select('*', { count: 'exact', head: true });

    // Cobranças por status
    const { data: cobrancasPorStatus } = await supabase
      .from('asaas_cobrancas')
      .select('status, valor');

    const statusCounts = {
      PENDING: 0,
      CONFIRMED: 0,
      RECEIVED: 0,
      OVERDUE: 0,
      REFUNDED: 0,
    };

    const statusValues = {
      PENDING: 0,
      CONFIRMED: 0,
      RECEIVED: 0,
      OVERDUE: 0,
      REFUNDED: 0,
    };

    cobrancasPorStatus?.forEach((cobranca) => {
      const status = cobranca.status as keyof typeof statusCounts;
      if (status in statusCounts) {
        statusCounts[status]++;
        statusValues[status] += parseFloat(cobranca.valor || '0');
      }
    });

    // Receita total (RECEIVED)
    const receitaTotal = statusValues.RECEIVED;

    // Pendentes
    const valorPendente = statusValues.PENDING;

    // Vencidos
    const valorVencido = statusValues.OVERDUE;

    // Agentes ativos
    const { count: agentesAtivos } = await supabase
      .from('asaas_agentes')
      .select('*', { count: 'exact', head: true })
      .eq('active', true);

    return NextResponse.json({
      dashboard: {
        totalCobrancas: totalCobrancas || 0,
        receitaTotal,
        valorPendente,
        valorVencido,
        agentesAtivos: agentesAtivos || 0,
        statusCounts,
        statusValues,
      },
    });
  } catch (error: any) {
    console.error('Erro ao buscar dashboard:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar dashboard' },
      { status: 500 }
    );
  }
}
