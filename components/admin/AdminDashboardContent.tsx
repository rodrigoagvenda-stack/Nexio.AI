'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Users, TrendingUp, DollarSign, AlertTriangle, Activity } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/format';
import { LineChart, Line, BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
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

  const COLORS = ['#8b5cf6', '#6366f1', '#3b82f6', '#0ea5e9', '#06b6d4'];

  return (
    <div className="space-y-8">
      {/* Hero Header */}
      <div className="border-b border-white/[0.08] pb-6 mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
          Painel Administrativo
        </h1>
        <p className="text-sm md:text-base text-muted-foreground">
          Gerencie empresas, usuários e configurações do sistema
        </p>
      </div>

      {/* Filtro de Data */}
      <div className="flex gap-2">
        {[
          { label: 'Últimos 7 dias', value: '7d' as const },
          { label: 'Últimos 30 dias', value: '30d' as const },
          { label: 'Últimos 3 meses', value: '3m' as const },
          { label: 'Este ano', value: '1y' as const },
        ].map((range) => (
          <Button
            key={range.value}
            variant={dateRange === range.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDateRange(range.value)}
            className={dateRange === range.value ? '' : 'bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.05]'}
          >
            {range.label}
          </Button>
        ))}
      </div>

      {/* Métricas Principais */}
      <div className="grid gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <div className="relative overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-6">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-transparent" />
          <div className="relative flex items-center justify-between space-y-0 pb-3">
            <h3 className="text-sm font-semibold">Empresas Ativas</h3>
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Building2 className="h-5 w-5 text-blue-400" />
            </div>
          </div>
          <div className="relative">
            <div className="text-3xl font-bold text-foreground">{activeCompanies}</div>
            <p className="text-sm text-muted-foreground mt-1">{totalCompanies} total</p>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-6">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-transparent" />
          <div className="relative flex items-center justify-between space-y-0 pb-3">
            <h3 className="text-sm font-semibold">Usuários Ativos</h3>
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <Users className="h-5 w-5 text-purple-400" />
            </div>
          </div>
          <div className="relative">
            <div className="text-3xl font-bold text-foreground">{activeUsers}</div>
            <p className="text-sm text-muted-foreground mt-1">{totalUsers} total</p>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-6">
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-transparent to-transparent" />
          <div className="relative flex items-center justify-between space-y-0 pb-3">
            <h3 className="text-sm font-semibold">Leads Extraídos</h3>
            <div className="p-2 bg-cyan-500/10 rounded-lg">
              <TrendingUp className="h-5 w-5 text-cyan-400" />
            </div>
          </div>
          <div className="relative">
            <div className="text-3xl font-bold text-foreground">{leadsToday}</div>
            <p className="text-sm text-muted-foreground mt-1">Hoje • {leadsThisMonth} este mês</p>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-6">
          <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 via-transparent to-transparent" />
          <div className="relative flex items-center justify-between space-y-0 pb-3">
            <h3 className="text-sm font-semibold">MRR</h3>
            <div className="p-2 bg-green-500/10 rounded-lg">
              <DollarSign className="h-5 w-5 text-green-400" />
            </div>
          </div>
          <div className="relative">
            <div className="text-3xl font-bold text-green-400">{formatCurrency(mrr)}</div>
            <p className="text-sm text-muted-foreground mt-1">Monthly Recurring Revenue</p>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-6">
          <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 via-transparent to-transparent" />
          <div className="relative flex items-center justify-between space-y-0 pb-3">
            <h3 className="text-sm font-semibold">Inadimplentes</h3>
            <div className="p-2 bg-red-500/10 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-red-400" />
            </div>
          </div>
          <div className="relative">
            <div className="text-3xl font-bold text-red-400">{inadimplentes}</div>
            <p className="text-sm text-muted-foreground mt-1">Assinaturas vencidas</p>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-6">
          <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 via-transparent to-transparent" />
          <div className="relative flex items-center justify-between space-y-0 pb-3">
            <h3 className="text-sm font-semibold">Briefings Hoje</h3>
            <div className="p-2 bg-orange-500/10 rounded-lg">
              <Activity className="h-5 w-5 text-orange-400" />
            </div>
          </div>
          <div className="relative">
            <div className="text-3xl font-bold text-foreground">{briefingsToday}</div>
            <p className="text-sm text-muted-foreground mt-1">{totalBriefings} total</p>
          </div>
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Leads ao longo do tempo */}
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-6">
          <h3 className="text-lg font-semibold mb-4">Leads Extraídos</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={leadsOverTime}>
              <defs>
                <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="date" stroke="rgba(255,255,255,0.5)" style={{ fontSize: '12px' }} />
              <YAxis stroke="rgba(255,255,255,0.5)" style={{ fontSize: '12px' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(0,0,0,0.8)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                }}
              />
              <Area type="monotone" dataKey="count" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorLeads)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Receita ao longo do tempo */}
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-6">
          <h3 className="text-lg font-semibold mb-4">Evolução do MRR</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={revenueOverTime}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="date" stroke="rgba(255,255,255,0.5)" style={{ fontSize: '12px' }} />
              <YAxis stroke="rgba(255,255,255,0.5)" style={{ fontSize: '12px' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(0,0,0,0.8)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                }}
                formatter={(value: any) => formatCurrency(value)}
              />
              <Line type="monotone" dataKey="mrr" stroke="#10b981" strokeWidth={3} dot={{ fill: '#10b981', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Empresas por plano */}
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-6">
          <h3 className="text-lg font-semibold mb-4">Empresas por Plano</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={companiesByPlan}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="name" stroke="rgba(255,255,255,0.5)" style={{ fontSize: '12px' }} />
              <YAxis stroke="rgba(255,255,255,0.5)" style={{ fontSize: '12px' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(0,0,0,0.8)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                }}
              />
              <Bar dataKey="count" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Leads por status */}
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-6">
          <h3 className="text-lg font-semibold mb-4">Leads por Status</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={leadsByStatus}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="count"
              >
                {leadsByStatus.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(0,0,0,0.8)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
