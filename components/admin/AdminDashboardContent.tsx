'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Building2, Users, TrendingUp, DollarSign, AlertTriangle, MessageCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/format';
import {
  Bar, BarChart, CartesianGrid, XAxis, Tooltip,
  Area, AreaChart, Line, LineChart,
  ResponsiveContainer,
} from 'recharts';
import { ChartConfig, ChartContainer } from '@/components/ui/chart';

interface DashboardProps {
  activeCompanies: number;
  totalCompanies: number;
  activeUsers: number;
  totalUsers: number;
  leadsCount: number;
  conversasCount: number;
  mrr: number;
  inadimplentes: number;
  companiesByPlan: { plan: string; count: number; name: string }[];
  leadsOverTime: { date: string; count: number }[];
  revenueOverTime: { date: string; mrr: number }[];
  period: string;
  customFrom?: string;
  customTo?: string;
}

const PERIODS = [
  { label: 'Hoje',          value: 'today'     },
  { label: 'Ontem',         value: 'yesterday' },
  { label: 'Última Semana', value: 'week'      },
  { label: 'Último Mês',    value: 'month'     },
  { label: 'Último Ano',    value: 'year'      },
  { label: 'Personalizado', value: 'custom'    },
];

const TOOLTIP_STYLE = {
  backgroundColor: 'hsl(var(--popover))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '6px',
  color: 'hsl(var(--popover-foreground))',
};

const leadsChartConfig   = { count: { label: 'Leads', color: '#15803d' } } satisfies ChartConfig;
const mrrChartConfig     = { mrr:   { label: 'MRR',   color: '#15803d' } } satisfies ChartConfig;
const planChartConfig    = { count: { label: 'Empresas', color: '#15803d' } } satisfies ChartConfig;

export function AdminDashboardContent({
  activeCompanies, totalCompanies,
  activeUsers, totalUsers,
  leadsCount, conversasCount,
  mrr, inadimplentes,
  companiesByPlan, leadsOverTime, revenueOverTime,
  period, customFrom, customTo,
}: DashboardProps) {
  const router = useRouter();
  const [from, setFrom] = useState(customFrom || '');
  const [to, setTo]     = useState(customTo   || '');

  function navigate(p: string, f?: string, t?: string) {
    const params = new URLSearchParams({ period: p });
    if (p === 'custom' && f) params.set('from', f);
    if (p === 'custom' && t) params.set('to', t);
    router.push(`/admin?${params}`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Painel Administrativo</h1>
        <p className="text-muted-foreground mt-1">Controle operacional da Zaapli</p>
      </div>

      {/* Filtros de Período */}
      <div className="flex flex-wrap gap-2 items-center">
        {PERIODS.map((p) => (
          <Button
            key={p.value}
            variant={period === p.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => navigate(p.value)}
          >
            {p.label}
          </Button>
        ))}
        {period === 'custom' && (
          <div className="flex items-center gap-2 mt-2 sm:mt-0">
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-36 h-8 text-xs"
            />
            <span className="text-muted-foreground text-xs">até</span>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-36 h-8 text-xs"
            />
            <Button size="sm" onClick={() => navigate('custom', from, to)}>
              Aplicar
            </Button>
          </div>
        )}
      </div>

      {/* Métricas */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between pb-2">
              <p className="text-sm text-muted-foreground">Empresas Ativas</p>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-3xl font-bold">{activeCompanies}</div>
            <p className="text-xs text-muted-foreground mt-1">{totalCompanies} total</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between pb-2">
              <p className="text-sm text-muted-foreground">Usuários Ativos</p>
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-3xl font-bold">{activeUsers}</div>
            <p className="text-xs text-muted-foreground mt-1">{totalUsers} total</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between pb-2">
              <p className="text-sm text-muted-foreground">MRR</p>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-3xl font-bold">{formatCurrency(mrr)}</div>
            <p className="text-xs text-muted-foreground mt-1">Monthly Recurring Revenue</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between pb-2">
              <p className="text-sm text-muted-foreground">Inadimplentes</p>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-3xl font-bold">{inadimplentes}</div>
            <p className="text-xs text-muted-foreground mt-1">Assinaturas vencidas</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between pb-2">
              <p className="text-sm text-muted-foreground">Conversas no Período</p>
              <MessageCircle className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-3xl font-bold">{conversasCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Atendimentos WhatsApp</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between pb-2">
              <p className="text-sm text-muted-foreground">Leads no Período</p>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-3xl font-bold">{leadsCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Contatos no CRM</p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Leads no Período</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={leadsChartConfig} className="h-[260px] w-full">
              <AreaChart data={leadsOverTime}>
                <defs>
                  <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#15803d" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#15803d" stopOpacity={0}   />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Area type="monotone" dataKey="count" stroke="#15803d" strokeWidth={2} fillOpacity={1} fill="url(#colorLeads)" />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Evolução do MRR</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={mrrChartConfig} className="h-[260px] w-full">
              <LineChart data={revenueOverTime}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => [formatCurrency(v), 'MRR']} />
                <Line type="monotone" dataKey="mrr" stroke="#15803d" strokeWidth={2} dot={{ fill: '#15803d', r: 3 }} />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Empresas por Plano</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={planChartConfig} className="h-[260px] w-full">
              <BarChart data={companiesByPlan}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="count" fill="#15803d" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
