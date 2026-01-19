import { createClient } from '@/lib/supabase/server';
import { N8NMonitorContent } from '@/components/admin/N8NMonitorContent';

export default async function N8NMonitorPage() {
  const supabase = await createClient();

  // Buscar instâncias N8N
  const { data: instances } = await supabase
    .from('n8n_instances')
    .select('*')
    .order('created_at', { ascending: false });

  // Buscar erros recentes (últimos 100)
  const { data: errors } = await supabase
    .from('n8n_errors')
    .select(`
      *,
      instance:n8n_instances(id, name, url)
    `)
    .order('timestamp', { ascending: false })
    .limit(100);

  // Calcular estatísticas
  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const { count: errors24h } = await supabase
    .from('n8n_errors')
    .select('*', { count: 'exact', head: true })
    .gte('timestamp', last24h.toISOString());

  const { count: totalInstances } = await supabase
    .from('n8n_instances')
    .select('*', { count: 'exact', head: true });

  // Calcular uptime médio (baseado em instâncias ativas)
  const activeInstances = instances?.filter(i => i.active) || [];
  const uptimeAverage = activeInstances.length > 0
    ? Math.round((activeInstances.length / (totalInstances || 1)) * 100)
    : 0;

  const stats = {
    totalInstances: totalInstances || 0,
    errors24h: errors24h || 0,
    uptimeAverage,
    activeInstances: activeInstances.length,
  };

  return (
    <N8NMonitorContent
      instances={instances || []}
      errors={errors || []}
      stats={stats}
    />
  );
}
