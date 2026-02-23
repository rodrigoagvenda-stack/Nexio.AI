import { createServiceClient } from '@/lib/supabase/server';
import { AdminDashboardContent } from '@/components/admin/AdminDashboardContent';

export default async function AdminDashboardPage() {
  const supabase = createServiceClient();

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

  // MRR - calcular baseado nos novos planos
  const mrr = companies
    ?.filter((c) => c.is_active)
    .reduce((sum, c) => {
      const planValues: Record<string, number> = {
        basic: 1600,
        performance: 2000,
        advanced: 2600,
      };
      const planValue = planValues[c.plan_type] || 0;
      return sum + planValue;
    }, 0) || 0;

  // Empresas inadimplentes
  const inadimplentes = companies?.filter((c) => {
    if (!c.subscription_expires_at) return false;
    return new Date(c.subscription_expires_at) < new Date();
  }).length || 0;

  // Briefings recebidos hoje
  const briefingsToday = briefingResponses?.filter((b) =>
    b.submitted_at.startsWith(today)
  ).length || 0;

  // Dados para gráficos
  // Empresas por plano
  const companiesByPlan = [
    { plan: 'basic', name: 'NEXIO SALES', count: companies?.filter(c => c.plan_type === 'basic').length || 0 },
    { plan: 'performance', name: 'NEXIO GROWTH', count: companies?.filter(c => c.plan_type === 'performance').length || 0 },
    { plan: 'advanced', name: 'NEXIO ADS', count: companies?.filter(c => c.plan_type === 'advanced').length || 0 },
  ];

  // Leads ao longo do tempo (últimos 30 dias)
  const leadsOverTime = Array.from({ length: 30 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (29 - i));
    const dateStr = date.toISOString().split('T')[0];
    const count = leads?.filter(l => l.created_at.startsWith(dateStr)).length || 0;
    return {
      date: `${date.getDate()}/${date.getMonth() + 1}`,
      count,
    };
  });

  // Receita ao longo do tempo (últimos 6 meses)
  const revenueOverTime = Array.from({ length: 6 }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (5 - i));

    // Simular crescimento de MRR (em produção, buscar do histórico)
    const baseMrr = mrr;
    const factor = 0.8 + (i * 0.04);

    return {
      date: `${date.getMonth() + 1}/${date.getFullYear().toString().slice(2)}`,
      mrr: Math.round(baseMrr * factor),
    };
  });

  // Leads por status
  const leadsByStatus = [
    { status: 'Lead novo', count: leads?.filter(l => l.status === 'Lead novo').length || 0 },
    { status: 'Em contato', count: leads?.filter(l => l.status === 'Em contato').length || 0 },
    { status: 'Interessado', count: leads?.filter(l => l.status === 'Interessado').length || 0 },
    { status: 'Proposta enviada', count: leads?.filter(l => l.status === 'Proposta enviada').length || 0 },
    { status: 'Fechado', count: leads?.filter(l => l.status === 'Fechado').length || 0 },
  ].filter(item => item.count > 0);

  return (
    <AdminDashboardContent
      activeCompanies={activeCompanies}
      totalCompanies={companies?.length || 0}
      activeUsers={activeUsers}
      totalUsers={totalUsers}
      leadsToday={leadsToday}
      leadsThisMonth={leadsThisMonth}
      mrr={mrr}
      inadimplentes={inadimplentes}
      briefingsToday={briefingsToday}
      totalBriefings={briefingResponses?.length || 0}
      companiesByPlan={companiesByPlan}
      leadsOverTime={leadsOverTime}
      revenueOverTime={revenueOverTime}
      leadsByStatus={leadsByStatus}
    />
  );
}
