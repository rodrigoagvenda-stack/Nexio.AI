'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency } from '@/lib/utils/format';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ClosedLead {
  id: string;
  company_name: string;
  contact_name: string | null;
  project_value: number;
  updated_at: string;
}

export function RecentSales() {
  const [closedLeads, setClosedLeads] = useState<ClosedLead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchClosedLeads();
  }, []);

  const fetchClosedLeads = async () => {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data: userData } = await supabase
        .from('users')
        .select('company_id')
        .eq('auth_user_id', user.id)
        .single();

      if (!userData?.company_id) return;

      const { data: leadsData } = await supabase
        .from('leads')
        .select('id, company_name, contact_name, project_value, updated_at')
        .eq('company_id', userData.company_id)
        .eq('status', 'Fechado')
        .order('updated_at', { ascending: false })
        .limit(10);

      setClosedLeads(leadsData || []);
    } catch (error) {
      console.error('Error fetching closed leads:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Vendas Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-shrink-0">
        <CardTitle className="text-lg font-semibold">Vendas Recentes</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto">
        {closedLeads.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-muted-foreground">Nenhuma venda fechada ainda</p>
          </div>
        ) : (
          <div className="space-y-4">
            {closedLeads.map((lead) => (
              <div
                key={lead.id}
                className="flex items-start justify-between gap-3 pb-4 border-b border-border/50 last:border-0 last:pb-0"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-foreground truncate">
                    {lead.company_name}
                  </p>
                  {lead.contact_name && (
                    <p className="text-xs text-muted-foreground truncate">
                      {lead.contact_name}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(lead.updated_at), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className="text-sm font-semibold text-primary">
                    {formatCurrency(lead.project_value)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
