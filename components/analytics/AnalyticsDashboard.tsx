'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  MessageSquare,
  Users,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  BarChart3,
  Activity,
} from 'lucide-react';
import { UserPerformanceCard } from './UserPerformanceCard';
import { toast } from 'sonner';

interface AnalyticsOverview {
  total_chats: number;
  open_chats: number;
  closed_chats: number;
  unread_chats: number;
  total_messages: number;
  inbound_messages: number;
  outbound_messages: number;
  response_rate_percent: number;
  assigned_chats: number;
  unassigned_chats: number;
}

interface UserMetrics {
  user_id: number;
  user_name: string;
  user_email: string;
  total_assigned_chats: number;
  active_chats: number;
  resolved_chats: number;
  chats_with_unread: number;
  messages_sent: number;
  resolution_rate_percent: number;
  avg_response_time_minutes?: number;
}

interface DailyMetric {
  date: string;
  total_chats: number;
  new_chats: number;
  total_messages: number;
  received_messages: number;
  sent_messages: number;
  active_users: number;
}

interface TopLead {
  lead_id: number;
  lead_company: string;
  lead_name: string;
  total_messages: number;
  messages_received: number;
  messages_sent: number;
  last_message_at: string;
  chat_status: string;
}

interface AnalyticsDashboardProps {
  companyId: number;
}

export function AnalyticsDashboard({ companyId }: AnalyticsDashboardProps) {
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [userMetrics, setUserMetrics] = useState<UserMetrics[]>([]);
  const [dailyMetrics, setDailyMetrics] = useState<DailyMetric[]>([]);
  const [topLeads, setTopLeads] = useState<TopLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('7d');

  useEffect(() => {
    fetchAnalytics();
  }, [companyId, period]);

  async function fetchAnalytics() {
    setLoading(true);
    try {
      // Fetch overview and top leads
      const overviewRes = await fetch(`/api/analytics/overview?companyId=${companyId}`);
      const overviewData = await overviewRes.json();

      if (overviewData.success) {
        setOverview(overviewData.overview);
        setTopLeads(overviewData.topLeads || []);
        setDailyMetrics(overviewData.dailyMetrics || []);
      }

      // Fetch user metrics
      const userRes = await fetch(`/api/analytics/by-user?companyId=${companyId}`);
      const userData = await userRes.json();

      if (userData.success) {
        setUserMetrics(userData.users);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast.error('Erro ao carregar analytics');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Activity className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Chats</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview?.total_chats || 0}</div>
            <p className="text-xs text-muted-foreground">
              {overview?.open_chats || 0} abertos • {overview?.closed_chats || 0} fechados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mensagens</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview?.total_messages || 0}</div>
            <p className="text-xs text-muted-foreground">
              {overview?.inbound_messages || 0} recebidas • {overview?.outbound_messages || 0} enviadas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Resposta</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {overview?.response_rate_percent?.toFixed(1) || '0.0'}%
            </div>
            <p className="text-xs text-muted-foreground">
              Respostas por mensagens recebidas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Atribuições</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview?.assigned_chats || 0}</div>
            <p className="text-xs text-muted-foreground">
              {overview?.unassigned_chats || 0} não atribuídos
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users">
            <Users className="h-4 w-4 mr-2" />
            Desempenho por Usuário
          </TabsTrigger>
          <TabsTrigger value="daily">
            <BarChart3 className="h-4 w-4 mr-2" />
            Métricas Diárias
          </TabsTrigger>
          <TabsTrigger value="leads">
            <TrendingUp className="h-4 w-4 mr-2" />
            Top Leads
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {userMetrics.map((user) => (
              <UserPerformanceCard key={user.user_id} user={user} />
            ))}
            {userMetrics.length === 0 && (
              <Card className="col-span-2">
                <CardContent className="flex items-center justify-center h-32">
                  <p className="text-muted-foreground">Nenhum dado de usuário disponível</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="daily" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Atividade dos Últimos 30 Dias</CardTitle>
              <CardDescription>Métricas diárias de mensagens e conversas</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {dailyMetrics.slice(0, 10).map((day) => (
                  <div
                    key={day.date}
                    className="flex items-center justify-between border-b pb-3 last:border-0"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {new Date(day.date).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {day.active_users} usuários ativos
                      </p>
                    </div>
                    <div className="flex gap-4 text-sm">
                      <div className="text-center">
                        <p className="font-bold">{day.total_chats}</p>
                        <p className="text-xs text-muted-foreground">chats</p>
                      </div>
                      <div className="text-center">
                        <p className="font-bold">{day.total_messages}</p>
                        <p className="text-xs text-muted-foreground">msgs</p>
                      </div>
                      <div className="text-center">
                        <p className="font-bold">{day.received_messages}</p>
                        <p className="text-xs text-muted-foreground">recebidas</p>
                      </div>
                      <div className="text-center">
                        <p className="font-bold">{day.sent_messages}</p>
                        <p className="text-xs text-muted-foreground">enviadas</p>
                      </div>
                    </div>
                  </div>
                ))}
                {dailyMetrics.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhum dado diário disponível
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leads" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Top 50 Leads por Volume de Mensagens</CardTitle>
              <CardDescription>Últimos 30 dias</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {topLeads.slice(0, 20).map((lead, index) => (
                  <div
                    key={lead.lead_id}
                    className="flex items-center justify-between border-b pb-3 last:border-0"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted text-sm font-bold">
                        {index + 1}
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {lead.lead_company || lead.lead_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Última msg: {new Date(lead.last_message_at).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-sm font-bold">{lead.total_messages}</p>
                        <p className="text-xs text-muted-foreground">
                          ↓{lead.messages_received} • ↑{lead.messages_sent}
                        </p>
                      </div>
                      <Badge variant={lead.chat_status === 'open' ? 'default' : 'secondary'}>
                        {lead.chat_status === 'open' ? 'Aberto' : 'Fechado'}
                      </Badge>
                    </div>
                  </div>
                ))}
                {topLeads.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhum lead encontrado
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
