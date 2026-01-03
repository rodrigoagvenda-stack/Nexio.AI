'use client';

import { useEffect, useState } from 'react';
import { AnalyticsDashboard } from '@/components/analytics/AnalyticsDashboard';
import { createClient } from '@/lib/supabase/client';
import { Loader2 } from 'lucide-react';

export default function AnalyticsPage() {
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function getCompanyId() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const { data: userData } = await supabase
          .from('users')
          .select('company_id')
          .eq('user_id', user.id)
          .single();

        if (userData?.company_id) {
          setCompanyId(userData.company_id);
        }
      }
      setLoading(false);
    }

    getCompanyId();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!companyId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted-foreground">Erro ao carregar dados da empresa</p>
      </div>
    );
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

      <AnalyticsDashboard companyId={companyId} />
    </div>
  );
}
