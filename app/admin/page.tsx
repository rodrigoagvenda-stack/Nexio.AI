import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Users, TrendingUp, DollarSign, AlertTriangle, Activity } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/format';
import Link from 'next/link';

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  // Buscar métricas
  const { data: companies } = await supabase.from('companies').select('*');
  const { data: users } = await supabase.from('users').select('*');
  const { data: leads } = await supabase.from('leads').select('*');
  const { data: briefingResponses } = await supabase.from('briefing_responses').select('*');

  const activeCompanies = companies?.filter((c) => c.is_active).length || 0;
  const totalUsers = users?.length || 0;
  const activeUsers = users?.filter((u) => u.is_active).length || 0;

  // Leads extraídos hoje
  const today = new Date().toISOString().split('T')[0];
  const leadsToday = leads?.filter((l) => l.created_at.startsWith(today)).length || 0;

  // Leads extraídos este mês
  const currentMonth = new Date().toISOString().slice(0, 7);
  const leadsThisMonth = leads?.filter((l) => l.created_at.startsWith(currentMonth)).length || 0;

  // MRR - calcular baseado nos planos
  const mrr = companies
    ?.filter((c) => c.is_active)
    .reduce((sum, c) => {
      const planValues: Record<string, number> = {
        basic: 197,
        performance: 497,
        advanced: 997,
      };
      const planValue = planValues[c.plan_type] || 0;
      return sum + planValue;
    }, 0) || 0;

  // Empresas inadimplentes (subscription_expires_at < hoje)
  const inadimplentes = companies?.filter((c) => {
    if (!c.subscription_expires_at) return false;
    return new Date(c.subscription_expires_at) < new Date();
  }).length || 0;

  // Briefings recebidos hoje
  const briefingsToday = briefingResponses?.filter((b) =>
    b.submitted_at.startsWith(today)
  ).length || 0;

  return (
    <div className="space-y-8">
      {/* Hero Header */}
      <div className="border-b pb-6 mb-6">
        <h1 className="text-3xl font-bold text-foreground mb-2">
          Painel Administrativo
        </h1>
        <p className="text-muted-foreground">
          Gerencie empresas, usuários e configurações do sistema
        </p>
      </div>

      {/* Métricas Principais */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="border-2 shadow-lg hover:shadow-xl transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-semibold">Empresas Ativas</CardTitle>
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Building2 className="h-5 w-5 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-foreground">{activeCompanies}</div>
            <p className="text-sm text-muted-foreground mt-1">
              {companies?.length || 0} total
            </p>
          </CardContent>
        </Card>

        <Card className="border-2 shadow-lg hover:shadow-xl transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-semibold">Usuários Ativos</CardTitle>
            <div className="p-2 bg-zinc-700/10 rounded-lg">
              <Users className="h-5 w-5 text-zinc-700" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-foreground">{activeUsers}</div>
            <p className="text-sm text-muted-foreground mt-1">{totalUsers} total</p>
          </CardContent>
        </Card>

        <Card className="border-2 shadow-lg hover:shadow-xl transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-semibold">Leads Extraídos</CardTitle>
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <TrendingUp className="h-5 w-5 text-purple-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-foreground">{leadsToday}</div>
            <p className="text-sm text-muted-foreground mt-1">
              Hoje • {leadsThisMonth} este mês
            </p>
          </CardContent>
        </Card>

        <Card className="border-2 shadow-lg hover:shadow-xl transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-semibold">MRR</CardTitle>
            <div className="p-2 bg-primary/10 rounded-lg">
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-primary">{formatCurrency(mrr)}</div>
            <p className="text-sm text-muted-foreground mt-1">Monthly Recurring Revenue</p>
          </CardContent>
        </Card>

        <Card className="border-2 border-red-200 shadow-lg hover:shadow-xl transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-semibold">Inadimplentes</CardTitle>
            <div className="p-2 bg-red-500/10 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-red-500">{inadimplentes}</div>
            <p className="text-sm text-muted-foreground mt-1">Assinaturas vencidas</p>
          </CardContent>
        </Card>

        <Card className="border-2 shadow-lg hover:shadow-xl transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-semibold">Briefings Hoje</CardTitle>
            <div className="p-2 bg-cyan-500/10 rounded-lg">
              <Activity className="h-5 w-5 text-cyan-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-foreground">{briefingsToday}</div>
            <p className="text-sm text-muted-foreground mt-1">
              {briefingResponses?.length || 0} total
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
