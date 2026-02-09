'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Users, TrendingUp, DollarSign, AlertTriangle, Activity } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/format';
import { Bar, BarChart, CartesianGrid, XAxis, Tooltip, Area, AreaChart, Line, LineChart, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { ChartConfig, ChartContainer } from '@/components/ui/chart';
import { Button } from '@/components/ui/button';

interface DashboardProps {
  activeCompanies: number;
  totalCompanies: number;
  activeUsers: number;
  totalUsers: number;
  leadsToday: number;
  leadsThisMonth: number;
  mrr: number;
  inadimplentes: number;
  briefingsToday: number;
  totalBriefings: number;
  companiesByPlan: { plan: string; count: number; name: string }[];
  leadsOverTime: { date: string; count: number }[];
  revenueOverTime: { date: string; mrr: number }[];
  leadsByStatus: { status: string; count: number }[];
}

const leadsChartConfig = {
  count: { label: 'Leads', color: '#30184C' },
} satisfies ChartConfig;

const mrrChartConfig = {
  mrr: { label: 'MRR', color: '#30184C' },
} satisfies ChartConfig;

const planChartConfig = {
  count: { label: 'Empresas', color: '#30184C' },
} satisfies ChartConfig;

const COLORS = ['#30184C', '#462068', '#5c2d84', '#7240a0', '#8855bb', '#191919', '#333333'];

export function AdminDashboardContent({
  activeCompanies,
  totalCompanies,
  activeUsers,
  totalUsers,
  leadsToday,
  leadsThisMonth,
  mrr,
  inadimplentes,
  briefingsToday,
  totalBriefings,
  companiesByPlan,
  leadsOverTime,
  revenueOverTime,
  leadsByStatus,
}: DashboardProps) {
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '3m' | '1y'>('30d');

  const totalLeadsByStatus = leadsByStatus.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Painel Administrativo</h1>
        <p className="text-muted-foreground mt-1">
          Gerencie empresas, usuários e configurações do sistema
        </p>
      </div>

      {/* Filtro de Data */}
      <div className="flex gap-2">
        {[
          { label: '7 dias', value: '7d' as const },
          { label: '30 dias', value: '30d' as const },
          { label: '3 meses', value: '3m' as const },
          { label: '1 ano', value: '1y' as const },
        ].map((range) => (
          <Button
            key={range.value}
            variant={dateRange === range.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDateRange(range.value)}
          >
            {range.label}
          </Button>
        ))}
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
              <p className="text-sm text-muted-foreground">Leads Extraídos</p>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-3xl font-bold">{leadsToday}</div>
            <p className="text-xs text-muted-foreground mt-1">Hoje · {leadsThisMonth} este mês</p>
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
              <p className="text-sm text-muted-foreground">Briefings Hoje</p>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-3xl font-bold">{briefingsToday}</div>
            <p className="text-xs text-muted-foreground mt-1">{totalBriefings} total</p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Leads ao longo do tempo */}
        <Card>
          <CardHeader>
            <CardTitle>Leads Extraídos</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={leadsChartConfig} className="h-[280px] w-full">
              <AreaChart data={leadsOverTime}>
                <defs>
                  <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#30184C" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#30184C" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px',
                    color: 'hsl(var(--popover-foreground))',
                  }}
                />
                <Area type="monotone" dataKey="count" stroke="#30184C" strokeWidth={2} fillOpacity={1} fill="url(#colorLeads)" />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Evolução do MRR */}
        <Card>
          <CardHeader>
            <CardTitle>Evolução do MRR</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={mrrChartConfig} className="h-[280px] w-full">
              <LineChart data={revenueOverTime}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px',
                    color: 'hsl(var(--popover-foreground))',
                  }}
                  formatter={(value: any) => [formatCurrency(value), 'MRR']}
                />
                <Line type="monotone" dataKey="mrr" stroke="#30184C" strokeWidth={2} dot={{ fill: '#30184C', r: 3 }} />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Empresas por Plano */}
        <Card>
          <CardHeader>
            <CardTitle>Empresas por Plano</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={planChartConfig} className="h-[280px] w-full">
              <BarChart data={companiesByPlan}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px',
                    color: 'hsl(var(--popover-foreground))',
                  }}
                />
                <Bar dataKey="count" fill="#30184C" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Leads por Status */}
        <Card>
          <CardHeader>
            <CardTitle>Leads por Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={leadsByStatus}
                    cx="50%"
                    cy="50%"
                    innerRadius="40%"
                    outerRadius="70%"
                    paddingAngle={2}
                    dataKey="count"
                    strokeWidth={0}
                  >
                    {leadsByStatus.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                      color: 'hsl(var(--popover-foreground))',
                    }}
                    formatter={(value: any, name: string) => [value, name]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* Legend */}
            <div className="flex flex-wrap justify-center gap-4 mt-4">
              {leadsByStatus.map((item, index) => (
                <div key={item.status} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  <span className="text-xs text-muted-foreground">
                    {item.status} ({totalLeadsByStatus > 0 ? Math.round((item.count / totalLeadsByStatus) * 100) : 0}%)
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
