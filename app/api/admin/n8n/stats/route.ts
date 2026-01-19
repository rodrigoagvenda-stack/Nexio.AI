import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET /api/admin/n8n/stats - Estatísticas do monitor
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

    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Erros últimas 24h
    const { count: errors24h } = await supabase
      .from('n8n_errors')
      .select('*', { count: 'exact', head: true })
      .gte('timestamp', last24h.toISOString());

    // Erros não resolvidos
    const { count: unresolvedErrors } = await supabase
      .from('n8n_errors')
      .select('*', { count: 'exact', head: true })
      .eq('resolved', false);

    // Instâncias ativas
    const { count: activeInstances } = await supabase
      .from('n8n_instances')
      .select('*', { count: 'exact', head: true })
      .eq('active', true);

    // Erros por severidade (últimas 24h)
    const { data: errorsBySeverity } = await supabase
      .from('n8n_errors')
      .select('severity')
      .gte('timestamp', last24h.toISOString());

    const severityCounts = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };

    errorsBySeverity?.forEach((error) => {
      if (error.severity && error.severity in severityCounts) {
        severityCounts[error.severity as keyof typeof severityCounts]++;
      }
    });

    return NextResponse.json({
      stats: {
        errors24h: errors24h || 0,
        unresolvedErrors: unresolvedErrors || 0,
        activeInstances: activeInstances || 0,
        severityCounts,
      },
    });
  } catch (error: any) {
    console.error('Erro ao buscar stats:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar stats' },
      { status: 500 }
    );
  }
}
