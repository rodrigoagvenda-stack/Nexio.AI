'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { createClient } from '@/lib/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, TrendingUp, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Lead {
  id: string;
  name: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface StageActivity {
  stage: string;
  count: number;
  leads: Lead[];
}

export function RealTimeActivity() {
  const [newLeads, setNewLeads] = useState<Lead[]>([]);
  const [stageActivities, setStageActivities] = useState<StageActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<number | null>(null);

  useEffect(() => {
    // Buscar company_id uma vez e guardar
    const init = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData } = await supabase
        .from('users')
        .select('company_id')
        .eq('auth_user_id', user.id)
        .single();

      if (userData?.company_id) {
        setCompanyId(userData.company_id);
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (!companyId) return;

    fetchRealtimeData(companyId);

    const supabase = createClient();
    const channel = supabase
      .channel('leads-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'leads',
          filter: `company_id=eq.${companyId}`,
        },
        () => {
          fetchRealtimeData(companyId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId]);

  const fetchRealtimeData = async (cId: number) => {
    try {
      const supabase = createClient();

      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);

      const stages = ['Lead novo', 'Em contato', 'Interessado', 'Proposta enviada', 'Fechado'];

      // Buscar leads recentes + top 5 por estágio em paralelo
      const [{ data: leadsData }, ...stageResults] = await Promise.all([
        supabase
          .from('leads')
          .select('id, name, status, created_at, updated_at')
          .eq('company_id', cId)
          .gte('created_at', oneDayAgo.toISOString())
          .order('created_at', { ascending: false })
          .limit(10),
        ...stages.map((stage) =>
          supabase
            .from('leads')
            .select('id, name, status, created_at, updated_at', { count: 'exact' })
            .eq('company_id', cId)
            .eq('status', stage)
            .order('updated_at', { ascending: false })
            .limit(5)
        ),
      ]);

      setNewLeads(leadsData || []);

      const stageGroups = stages.map((stage, i) => ({
        stage,
        count: stageResults[i].count || 0,
        leads: (stageResults[i].data || []) as Lead[],
      }));

      setStageActivities(stageGroups);
    } catch (error) {
      console.error('Error fetching realtime data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStageColor = (stage: string) => {
    const colors: Record<string, string> = {
      'Lead novo': 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
      'Em contato': 'bg-purple-400/10 text-purple-400',
      'Interessado': 'bg-primary/10 text-primary',
      'Proposta enviada': 'bg-purple-600/10 text-purple-600 dark:text-purple-400',
      'Fechado': 'bg-green-500/10 text-green-600 dark:text-green-400',
    };
    return colors[stage] || 'bg-muted text-muted-foreground';
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Atividade em tempo real</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center">
            <div className="animate-pulse text-muted-foreground">Carregando...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Atividade em tempo real
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="new" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="new" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Novos leads
              </TabsTrigger>
              <TabsTrigger value="stages" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Etapas
              </TabsTrigger>
            </TabsList>

            <TabsContent value="new" className="mt-4">
              <div className="space-y-2 max-h-[300px] overflow-y-auto scrollbar-minimal">
                <AnimatePresence mode="popLayout">
                  {newLeads.length === 0 ? (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="text-center py-8 text-muted-foreground text-sm"
                    >
                      Nenhum lead novo nas últimas 24 horas
                    </motion.div>
                  ) : (
                    newLeads.map((lead, index) => (
                      <motion.div
                        key={lead.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ delay: index * 0.05 }}
                        className="p-3 rounded-lg bg-accent/50 hover:bg-accent transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm text-foreground truncate">
                              {lead.name}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <span
                                className={`text-xs px-2 py-0.5 rounded-full ${getStageColor(
                                  lead.status
                                )}`}
                              >
                                {lead.status}
                              </span>
                            </div>
                          </div>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatDistanceToNow(new Date(lead.created_at), {
                              addSuffix: true,
                              locale: ptBR,
                            })}
                          </span>
                        </div>
                      </motion.div>
                    ))
                  )}
                </AnimatePresence>
              </div>
            </TabsContent>

            <TabsContent value="stages" className="mt-4">
              <div className="space-y-3 max-h-[300px] overflow-y-auto scrollbar-minimal">
                {stageActivities.map((activity, index) => (
                  <motion.div
                    key={activity.stage}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">
                        {activity.stage}
                      </span>
                      <span className="text-xs font-semibold text-primary">
                        {activity.count}
                      </span>
                    </div>
                    {activity.leads.length > 0 ? (
                      <div className="space-y-1 pl-3 border-l-2 border-primary/20">
                        {activity.leads.map((lead) => (
                          <div
                            key={lead.id}
                            className="text-xs text-muted-foreground py-1 truncate"
                          >
                            {lead.name}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground pl-3">
                        Nenhum lead nesta etapa
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </motion.div>
  );
}
