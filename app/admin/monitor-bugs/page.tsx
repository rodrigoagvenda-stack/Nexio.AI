import { createClient } from '@/lib/supabase/server';
import { MonitorBugsContent } from '@/components/admin/MonitorBugsContent';

export default async function MonitorBugsPage() {
  const supabase = await createClient();

  // Buscar bugs do sistema
  const { data: bugs } = await supabase
    .from('system_bugs')
    .select(`
      *,
      company:companies(name),
      user:users(name, email),
      resolvido_por:admin_users(name)
    `)
    .order('created_at', { ascending: false });

  // Estatísticas
  const { count: totalBugs } = await supabase
    .from('system_bugs')
    .select('*', { count: 'exact', head: true });

  const { count: bugsAbertos } = await supabase
    .from('system_bugs')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'aberto');

  const { count: bugsResolvidos } = await supabase
    .from('system_bugs')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'resolvido');

  const { count: bugsEmAnalise } = await supabase
    .from('system_bugs')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'em_analise');

  return (
    <MonitorBugsContent
      bugs={bugs || []}
      stats={{
        total: totalBugs || 0,
        abertos: bugsAbertos || 0,
        resolvidos: bugsResolvidos || 0,
        emAnalise: bugsEmAnalise || 0,
      }}
    />
  );
}
