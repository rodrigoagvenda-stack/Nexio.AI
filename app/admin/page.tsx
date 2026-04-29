export const dynamic = 'force-dynamic';

import { createServiceClient } from '@/lib/supabase/server';
import { AdminDashboardContent } from '@/components/admin/AdminDashboardContent';

function getDateRange(period: string, from?: string, to?: string) {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  switch (period) {
    case 'today':
      return { start: new Date(`${todayStr}T00:00:00`), end: now };
    case 'yesterday': {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const ys = y.toISOString().split('T')[0];
      return { start: new Date(`${ys}T00:00:00`), end: new Date(`${ys}T23:59:59`) };
    }
    case 'week': {
      const w = new Date(now);
      w.setDate(w.getDate() - 7);
      return { start: w, end: now };
    }
    case 'year': {
      const y = new Date(now);
      y.setFullYear(y.getFullYear() - 1);
      return { start: y, end: now };
    }
    case 'custom':
      return {
        start: from ? new Date(`${from}T00:00:00`) : new Date(`${todayStr}T00:00:00`),
        end: to ? new Date(`${to}T23:59:59`) : now,
      };
    default: {
      const m = new Date(now);
      m.setDate(m.getDate() - 30);
      return { start: m, end: now };
    }
  }
}

type SearchParams = { period?: string; from?: string; to?: string };

export default async function AdminDashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = createServiceClient();
  const period = searchParams.period || 'month';
  const { start, end } = getDateRange(period, searchParams.from, searchParams.to);
  const startIso = start.toISOString();
  const endIso = end.toISOString();

  const [
    { data: companies },
    { data: users },
    { data: leadsInPeriod },
    { data: conversas },
  ] = await Promise.all([
    supabase.from('companies').select('*'),
    supabase.from('users').select('*'),
    supabase.from('leads').select('id, created_at, status').gte('created_at', startIso).lte('created_at', endIso),
    supabase.from('conversas_do_whatsapp').select('id, created_at').gte('created_at', startIso).lte('created_at', endIso),
  ]);

  const activeCompanies = companies?.filter((c) => c.is_active).length || 0;
  const totalUsers = users?.length || 0;
  const activeUsers = users?.filter((u) => u.is_active).length || 0;

  const planValues: Record<string, number> = { basic: 0, starter: 1600, pro: 2000, scale: 2600 };
  const mrr = companies?.filter((c) => c.is_active).reduce((sum, c) => sum + (planValues[c.plan_type] || 0), 0) || 0;

  const inadimplentes = companies?.filter((c) => {
    if (!c.subscription_expires_at) return false;
    return new Date(c.subscription_expires_at) < new Date();
  }).length || 0;

  const leadsCount = leadsInPeriod?.length || 0;
  const conversasCount = conversas?.length || 0;

  const companiesByPlan = [
    { plan: 'basic',   name: 'ZAAPLI FREE',   count: companies?.filter(c => c.plan_type === 'basic').length   || 0 },
    { plan: 'starter', name: 'ZAAPLI START',  count: companies?.filter(c => c.plan_type === 'starter').length || 0 },
    { plan: 'pro',     name: 'ZAAPLI GROWTH', count: companies?.filter(c => c.plan_type === 'pro').length     || 0 },
    { plan: 'scale',   name: 'ZAAPLI PRO',    count: companies?.filter(c => c.plan_type === 'scale').length   || 0 },
  ];

  const diffDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  const points = Math.min(diffDays, 30);
  const leadsOverTime = Array.from({ length: points }, (_, i) => {
    const date = new Date(start);
    date.setDate(date.getDate() + Math.floor((i * diffDays) / points));
    const dateStr = date.toISOString().split('T')[0];
    const count = leadsInPeriod?.filter(l => l.created_at.startsWith(dateStr)).length || 0;
    return { date: `${date.getDate()}/${date.getMonth() + 1}`, count };
  });

  const revenueOverTime = Array.from({ length: 6 }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (5 - i));
    return {
      date: `${date.getMonth() + 1}/${date.getFullYear().toString().slice(2)}`,
      mrr: Math.round(mrr * (0.8 + i * 0.04)),
    };
  });

  return (
    <AdminDashboardContent
      activeCompanies={activeCompanies}
      totalCompanies={companies?.length || 0}
      activeUsers={activeUsers}
      totalUsers={totalUsers}
      leadsCount={leadsCount}
      conversasCount={conversasCount}
      mrr={mrr}
      inadimplentes={inadimplentes}
      companiesByPlan={companiesByPlan}
      leadsOverTime={leadsOverTime}
      revenueOverTime={revenueOverTime}
      period={period}
      customFrom={searchParams.from}
      customTo={searchParams.to}
    />
  );
}
