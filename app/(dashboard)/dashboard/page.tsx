'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Users, Target, TrendingUp, DollarSign } from 'lucide-react';
import { startOfDay, startOfWeek, startOfMonth, startOfYear, endOfDay, isWithinInterval } from 'date-fns';
import { DateRange } from 'react-day-picker';

import { MetricCard } from '@/components/dashboard/MetricCard';
import { FilterButtons, FilterPeriod } from '@/components/dashboard/FilterButtons';
import { DateRangePicker } from '@/components/dashboard/DateRangePicker';
import { PerformanceChart } from '@/components/dashboard/PerformanceChart';
import { ConversionDonut } from '@/components/dashboard/ConversionDonut';
import { SalesFunnel } from '@/components/dashboard/SalesFunnel';

interface Lead {
  id: string;
  status: string;
  project_value: number;
  created_at: string;
}

export default function DashboardPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<FilterPeriod>('month');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  useEffect(() => {
    fetchLeads();
  }, []);

  useEffect(() => {
    filterLeadsByPeriod();
  }, [selectedPeriod, dateRange, leads]);

  const fetchLeads = async () => {
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
        .select('id, status, project_value, created_at')
        .eq('company_id', userData.company_id)
        .order('created_at', { ascending: true });

      setLeads(leadsData || []);
    } catch (error) {
      console.error('Error fetching leads:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterLeadsByPeriod = () => {
    const now = new Date();
    let filtered = leads;

    if (selectedPeriod === 'custom') {
      if (dateRange?.from && dateRange?.to) {
        filtered = leads.filter((lead) => {
          const leadDate = new Date(lead.created_at);
          return isWithinInterval(leadDate, {
            start: dateRange.from!,
            end: endOfDay(dateRange.to!),
          });
        });
      }
    } else {
      const periodStarts = {
        today: startOfDay(now),
        week: startOfWeek(now, { weekStartsOn: 0 }),
        month: startOfMonth(now),
        year: startOfYear(now),
      };

      const periodStart = periodStarts[selectedPeriod as keyof typeof periodStarts];

      if (periodStart) {
        filtered = leads.filter((lead) => {
          const leadDate = new Date(lead.created_at);
          return leadDate >= periodStart;
        });
      }
    }

    setFilteredLeads(filtered);
  };

  const handlePeriodChange = (period: FilterPeriod) => {
    setSelectedPeriod(period);
    if (period !== 'custom') {
      setDateRange(undefined);
    }
  };

  // Métricas
  const totalLeads = filteredLeads.length;
  const novosLeads = filteredLeads.filter((l) => l.status === 'Lead novo').length;
  const emAtendimento = filteredLeads.filter((l) => l.status === 'Em contato').length;
  const fechados = filteredLeads.filter((l) => l.status === 'Fechado').length;
  const faturamento = filteredLeads
    .filter((l) => l.status === 'Fechado')
    .reduce((sum, l) => sum + (l.project_value || 0), 0);
  const taxaConversao = totalLeads > 0 ? ((fechados / totalLeads) * 100).toFixed(1) : '0.0';

  // Dados do gráfico de performance (últimos 7 dias ou semanas)
  const performanceData = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    const dayName = date.toLocaleDateString('pt-BR', { weekday: 'short' });

    const dayLeads = filteredLeads.filter((lead) => {
      const leadDate = new Date(lead.created_at);
      return leadDate.toDateString() === date.toDateString();
    });

    return {
      name: dayName,
      leads: dayLeads.length,
      fechados: dayLeads.filter((l) => l.status === 'Fechado').length,
    };
  });

  // Dados do donut de conversão
  const conversionData = [
    { name: 'Fechados', value: fechados, color: '#10b981' },
    { name: 'Em andamento', value: totalLeads - fechados, color: 'hsl(var(--primary))' },
  ];

  // Dados do funil
  const funnelStages = [
    {
      label: 'Lead novo',
      count: filteredLeads.filter((l) => l.status === 'Lead novo').length,
      color: 'bg-blue-500',
    },
    {
      label: 'Em contato',
      count: filteredLeads.filter((l) => l.status === 'Em contato').length,
      color: 'bg-yellow-500',
    },
    {
      label: 'Interessado',
      count: filteredLeads.filter((l) => l.status === 'Interessado').length,
      color: 'bg-orange-500',
    },
    {
      label: 'Proposta enviada',
      count: filteredLeads.filter((l) => l.status === 'Proposta enviada').length,
      color: 'bg-purple-500',
    },
    {
      label: 'Fechado',
      count: fechados,
      color: 'bg-green-500',
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <div className="animate-shimmer h-8 w-48 rounded"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com Filtros */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">Overview</h1>
        <div className="flex gap-2">
          <button
            onClick={() => handlePeriodChange('today')}
            className={`px-4 py-2 text-sm rounded-md transition-colors ${
              selectedPeriod === 'today'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted hover:bg-muted/80'
            }`}
          >
            Hoje
          </button>
          <button
            onClick={() => handlePeriodChange('week')}
            className={`px-4 py-2 text-sm rounded-md transition-colors ${
              selectedPeriod === 'week'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted hover:bg-muted/80'
            }`}
          >
            Semana
          </button>
          <button
            onClick={() => handlePeriodChange('month')}
            className={`px-4 py-2 text-sm rounded-md transition-colors ${
              selectedPeriod === 'month'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted hover:bg-muted/80'
            }`}
          >
            Mês
          </button>
          <button
            onClick={() => handlePeriodChange('year')}
            className={`px-4 py-2 text-sm rounded-md transition-colors ${
              selectedPeriod === 'year'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted hover:bg-muted/80'
            }`}
          >
            Ano
          </button>
        </div>
      </div>

      {/* Cards de Métricas */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Novos leads"
          value={novosLeads}
          subtitle={`${novosLeads} novos leads`}
          icon={Users}
          format="number"
        />
        <MetricCard
          title="Em atendimento"
          value={emAtendimento}
          subtitle={`Leads em atendimento`}
          icon={Target}
          format="number"
        />
        <MetricCard
          title="Taxa de conversão"
          value={taxaConversao}
          subtitle={`Leads convertidos`}
          icon={TrendingUp}
          format="percentage"
        />
        <MetricCard
          title="Faturamento"
          value={faturamento}
          subtitle={`Faturamento em negócios`}
          icon={DollarSign}
          format="currency"
        />
      </div>

      {/* Performance e Taxa de Conversão */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <PerformanceChart data={performanceData} />
        </div>
        <div>
          <ConversionDonut data={conversionData} />
        </div>
      </div>

      {/* Funil de Vendas */}
      <SalesFunnel stages={funnelStages} totalLeads={totalLeads} />
    </div>
  );
}
