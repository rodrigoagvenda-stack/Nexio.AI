import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AnalyticsDashboard } from '@/components/analytics/AnalyticsDashboard';

export default async function AnalyticsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Get user's company
  const { data: userData } = await supabase
    .from('users')
    .select('company_id, companies(id, name)')
    .eq('user_id', user.id)
    .single();

  if (!userData?.company_id) {
    redirect('/login');
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground">
            Relatórios e métricas de desempenho do atendimento
          </p>
        </div>
      </div>

      <AnalyticsDashboard companyId={userData.company_id} />
    </div>
  );
}
