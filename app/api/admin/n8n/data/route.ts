import { createServiceClient, createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET /api/admin/n8n/data - Retorna dados do monitor N8N
export async function GET() {
  try {
    // Verificar autenticação
    const authSupabase = await createClient();
    const { data: { user } } = await authSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const { data: adminUser } = await authSupabase
      .from('admin_users')
      .select('id')
      .eq('auth_user_id', user.id)
      .eq('is_active', true)
      .single();

    if (!adminUser) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    // Usar service client para bypassar RLS
    const supabase = createServiceClient();

    // Buscar instâncias
    const { data: instances, error: instancesError } = await supabase
      .from('n8n_instances')
      .select('*')
      .order('created_at', { ascending: false });

    if (instancesError) {
      console.error('Erro ao buscar instâncias:', instancesError);
    }

    // Buscar erros (sem join para evitar problemas de FK)
    const { data: errors, error: errorsError } = await supabase
      .from('n8n_errors')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);

    if (errorsError) {
      console.error('[N8N-DATA] Erro ao buscar erros:', errorsError.message);
    }

    console.log(`[N8N-DATA] ${instances?.length || 0} instâncias, ${errors?.length || 0} erros encontrados`);

    // Mapear instâncias para os erros manualmente
    const instanceMap = new Map(
      (instances || []).map(i => [i.id, { id: i.id, name: i.name, url: i.url }])
    );

    const errorsWithInstance = (errors || []).map(error => ({
      ...error,
      instance: instanceMap.get(error.instance_id) || null,
    }));

    // Stats
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const { count: errors24h } = await supabase
      .from('n8n_errors')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', last24h.toISOString());

    const totalInstances = instances?.length || 0;
    const activeInstances = instances?.filter(i => i.active) || [];
    const uptimeAverage = activeInstances.length > 0
      ? Math.round((activeInstances.length / (totalInstances || 1)) * 100)
      : 0;

    return NextResponse.json({
      instances: instances || [],
      errors: errorsWithInstance,
      stats: {
        totalInstances,
        errors24h: errors24h || 0,
        uptimeAverage,
        activeInstances: activeInstances.length,
      },
    });
  } catch (error: any) {
    console.error('Erro ao buscar dados N8N:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar dados' },
      { status: 500 }
    );
  }
}
