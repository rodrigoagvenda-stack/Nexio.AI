'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { UserRoundPlus, MessageCircleMore, TrendingUp, Users, CircleDollarSign, Bot } from 'lucide-react';
import { startOfDay, startOfWeek, startOfMonth, startOfYear, endOfDay, isWithinInterval } from 'date-fns';

interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

import { MetricCard } from '@/components/dashboard/MetricCard';
import { FilterPeriod } from '@/components/dashboard/FilterButtons';
import { DateRangePicker } from '@/components/dashboard/DateRangePicker';
import { PerformanceChart } from '@/components/dashboard/PerformanceChart';
import { ConversionDonut } from '@/components/dashboard/ConversionDonut';
import { SalesFunnelTabs } from '@/components/dashboard/SalesFunnelTabs';
import { RecentSales } from '@/components/dashboard/RecentSales';

interface Lead {
  id: string;
  status: string;
  project_value: number;
  created_at: string;
  closed_at: string | null;
  outbound_responded: boolean;
  outbound_meeting: boolean;
  outbound_followups: number;
}

export default function DashboardPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [outboundAbordados, setOutboundAbordados] = useState(0);
  const [antiNoshowCounts, setAntiNoshowCounts] = useState<Record<string, number>>({});
  const [selectedPeriod, setSelectedPeriod] = useState<FilterPeriod>('month');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [showDatePicker, setShowDatePicker] = useState(false);

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
        .select('id, status, project_value, created_at, closed_at, outbound_responded, outbound_meeting, outbound_followups')
        .eq('company_id', userData.company_id)
        .order('created_at', { ascending: true });

      setLeads(leadsData || []);

      // Abordados: distinct lead_ids em outbound_campaigns com tentativas > 0
      const { data: abordadosRows } = await supabase
        .from('outbound_campaigns')
        .select('lead_id')
        .eq('company_id', userData.company_id)
        .gt('tentativas', 0);
      setOutboundAbordados(new Set(abordadosRows?.map((r: any) => r.lead_id)).size);

      // Anti Noshow: contar disparos por momento
      const { data: followLogsData } = await supabase
        .from('follow_logs')
        .select('momento')
        .eq('company_id', userData.company_id);

      const counts: Record<string, number> = {};
      (followLogsData || []).forEach((r: any) => {
        if (r.momento) counts[r.momento] = (counts[r.momento] || 0) + 1;
      });
      setAntiNoshowCounts(counts);
    } catch (error) {
      console.error('Error fetching leads:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterLeadsByPeriod = () => {
    if (leads.length === 0) {
      setFilteredLeads([]);
      return;
    }

    const now = new Date();
    let filtered = leads;

    if (selectedPeriod === 'custom') {
      if (dateRange?.from && dateRange?.to) {
        filtered = leads.filter((lead) => {
          const leadDate = new Date(lead.created_at);
          return isWithinInterval(leadDate, {
            start: startOfDay(dateRange.from!),
            end: endOfDay(dateRange.to!),
          });
        });
      } else {
        // Se custom mas sem range, mostra todos
        filtered = leads;
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
          return leadDate >= periodStart && leadDate <= now;
        });
      }
    }

    setFilteredLeads(filtered);
  };

  const handlePeriodChange = (period: FilterPeriod) => {
    setSelectedPeriod(period);
    if (period !== 'custom') {
      setDateRange(undefined);
      setShowDatePicker(false);
    } else {
      setShowDatePicker(true);
    }
  };

  // Métricas base (período filtrado)
  const novosLeads = filteredLeads.filter((l) => l.status === 'Lead novo').length;
  const emAtendimento = filteredLeads.filter((l) => l.status === 'Em contato').length;

  // Estado atual do pipeline (independente do período — reflete situação real agora)
  const triagem = leads.filter((l) => l.status === 'Triagem').length;
  const outboundAtivos = leads.filter((l) => l.status === 'Outbound').length;

  // Para leads fechados, filtramos TODOS os leads por closed_at dentro do período
  const now = new Date();
  let leadsClosedInPeriod = leads.filter((l) => l.status === 'Fechado' && l.closed_at);

  if (selectedPeriod !== 'custom') {
    const periodStarts = {
      today: startOfDay(now),
      week: startOfWeek(now, { weekStartsOn: 0 }),
      month: startOfMonth(now),
      year: startOfYear(now),
    };
    const periodStart = periodStarts[selectedPeriod as keyof typeof periodStarts];

    if (periodStart) {
      leadsClosedInPeriod = leadsClosedInPeriod.filter((l) => {
        const closedDate = new Date(l.closed_at!);
        return closedDate >= periodStart && closedDate <= now;
      });
    }
  } else if (dateRange?.from && dateRange?.to) {
    leadsClosedInPeriod = leadsClosedInPeriod.filter((l) => {
      const closedDate = new Date(l.closed_at!);
      return isWithinInterval(closedDate, {
        start: startOfDay(dateRange.from!),
        end: endOfDay(dateRange.to!),
      });
    });
  }

  const fechados = leadsClosedInPeriod.length;
  const faturamento = leadsClosedInPeriod.reduce((sum, l) => sum + (l.project_value || 0), 0);

  // Em negociação: soma de project_value de leads ativos (não fechados nem perdidos)
  const faturamentoEmNegociacao = filteredLeads
    .filter((l) => l.status !== 'Fechado' && l.status !== 'Perdido')
    .reduce((sum, l) => sum + (l.project_value || 0), 0);

  // Taxa de conversão: fechados / total leads no período (inclui Outbound + Lead novo + demais)
  const totalLeads = filteredLeads.length;
  const taxaConversao = totalLeads > 0 ? ((fechados / totalLeads) * 100).toFixed(1) : '0.0';

  // Métricas IA Outbound
  const outboundRetornaram = filteredLeads.filter((l) => l.outbound_responded).length;
  const outboundReuniao = filteredLeads.filter((l) => l.outbound_meeting).length;
  const outboundFechados = leadsClosedInPeriod.filter(
    (l) => l.outbound_responded || l.outbound_meeting
  ).length;
  const outboundFollowups = filteredLeads.reduce((sum, l) => sum + (l.outbound_followups || 0), 0);

  // Debug: ver status dos leads
  const statusCount = filteredLeads.reduce((acc, l) => {
    acc[l.status] = (acc[l.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  console.log('📊 Status dos leads filtrados:', JSON.stringify(statusCount));
  console.log('💰 Leads fechados:', fechados, '| Faturamento:', faturamento);

  // Dados do gráfico de performance - ADAPTATIVO por período
  const generatePerformanceData = () => {
    const now = new Date();

    switch (selectedPeriod) {
      case 'today': {
        // HOJE: Mostrar 24 horas (0h-23h)
        const today = startOfDay(now);
        return Array.from({ length: 24 }, (_, i) => {
          const hourLeads = filteredLeads.filter((lead) => {
            const leadDate = new Date(lead.created_at);
            return (
              leadDate >= today &&
              leadDate < new Date(today.getTime() + 24 * 60 * 60 * 1000) &&
              leadDate.getHours() === i
            );
          });

          // Para fechados, usar closed_at
          const hourFechados = leadsClosedInPeriod.filter((lead) => {
            if (!lead.closed_at) return false;
            const closedDate = new Date(lead.closed_at);
            return (
              closedDate >= today &&
              closedDate < new Date(today.getTime() + 24 * 60 * 60 * 1000) &&
              closedDate.getHours() === i
            );
          });

          return {
            name: `${i}h`,
            leads: hourLeads.length,
            fechados: hourFechados.length,
          };
        });
      }

      case 'week': {
        // SEMANA: Mostrar 7 dias
        const weekStart = startOfWeek(now, { weekStartsOn: 0 });
        return Array.from({ length: 7 }, (_, i) => {
          const date = new Date(weekStart);
          date.setDate(date.getDate() + i);
          const dayName = date.toLocaleDateString('pt-BR', { weekday: 'short' });
          const dayStart = startOfDay(date);
          const dayEnd = endOfDay(date);

          const dayLeads = filteredLeads.filter((lead) => {
            const leadDate = new Date(lead.created_at);
            return leadDate >= dayStart && leadDate <= dayEnd;
          });

          // Para fechados, usar closed_at
          const dayFechados = leadsClosedInPeriod.filter((lead) => {
            if (!lead.closed_at) return false;
            const closedDate = new Date(lead.closed_at);
            return closedDate >= dayStart && closedDate <= dayEnd;
          });

          return {
            name: dayName,
            leads: dayLeads.length,
            fechados: dayFechados.length,
          };
        });
      }

      case 'month': {
        // MÊS: Mostrar semanas (4-5 semanas)
        const startOfMonthDate = startOfMonth(now);
        const weeks: { name: string; leads: number; fechados: number }[] = [];
        let weekNum = 1;

        for (let d = new Date(startOfMonthDate); d <= now; ) {
          const weekStart = startOfDay(d);
          const weekEnd = new Date(d);
          weekEnd.setDate(weekEnd.getDate() + 6);
          const weekEndDay = endOfDay(weekEnd);

          const weekLeads = filteredLeads.filter((lead) => {
            const leadDate = new Date(lead.created_at);
            return leadDate >= weekStart && leadDate <= weekEndDay;
          });

          // Para fechados, usar closed_at
          const weekFechados = leadsClosedInPeriod.filter((lead) => {
            if (!lead.closed_at) return false;
            const closedDate = new Date(lead.closed_at);
            return closedDate >= weekStart && closedDate <= weekEndDay;
          });

          weeks.push({
            name: `Sem ${weekNum}`,
            leads: weekLeads.length,
            fechados: weekFechados.length,
          });

          d.setDate(d.getDate() + 7);
          weekNum++;
        }

        return weeks.length > 0 ? weeks : [{ name: 'Sem 1', leads: 0, fechados: 0 }];
      }

      case 'year': {
        // ANO: Mostrar 12 meses
        return Array.from({ length: 12 }, (_, i) => {
          const monthDate = new Date(now.getFullYear(), i, 1);
          const monthName = monthDate.toLocaleDateString('pt-BR', { month: 'short' });

          const monthLeads = filteredLeads.filter((lead) => {
            const leadDate = new Date(lead.created_at);
            return leadDate.getMonth() === i && leadDate.getFullYear() === now.getFullYear();
          });

          // Para fechados no ano, usar closed_at
          const monthFechados = leadsClosedInPeriod.filter((l) => {
            if (!l.closed_at) return false;
            const closedDate = new Date(l.closed_at);
            return closedDate.getMonth() === i && closedDate.getFullYear() === now.getFullYear();
          });

          return {
            name: monthName.charAt(0).toUpperCase() + monthName.slice(1),
            leads: monthLeads.length,
            fechados: monthFechados.length,
          };
        });
      }

      case 'custom': {
        // PERSONALIZADO: Baseado no intervalo selecionado
        if (!dateRange?.from || !dateRange?.to) {
          return [{ name: 'Selecione um período', leads: 0, fechados: 0 }];
        }

        const diffTime = Math.abs(dateRange.to.getTime() - dateRange.from.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        // Se intervalo <= 7 dias, mostrar por dia
        if (diffDays <= 7) {
          return Array.from({ length: diffDays + 1 }, (_, i) => {
            const date = new Date(dateRange.from!);
            date.setDate(date.getDate() + i);
            const dayName = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
            const dayStart = startOfDay(date);
            const dayEnd = endOfDay(date);

            const dayLeads = filteredLeads.filter((lead) => {
              const leadDate = new Date(lead.created_at);
              return leadDate >= dayStart && leadDate <= dayEnd;
            });

            // Para fechados, usar closed_at
            const dayFechados = leadsClosedInPeriod.filter((l) => {
              if (!l.closed_at) return false;
              const closedDate = new Date(l.closed_at);
              return closedDate >= dayStart && closedDate <= dayEnd;
            });

            return {
              name: dayName,
              leads: dayLeads.length,
              fechados: dayFechados.length,
            };
          });
        }

        // Se intervalo > 7 dias, mostrar por semana
        const weeks: { name: string; leads: number; fechados: number }[] = [];
        let weekNum = 1;

        for (let d = new Date(dateRange.from); d <= dateRange.to; ) {
          const weekStart = startOfDay(d);
          const weekEnd = new Date(d);
          weekEnd.setDate(weekEnd.getDate() + 6);
          const weekEndDay = weekEnd > dateRange.to ? endOfDay(dateRange.to) : endOfDay(weekEnd);

          const weekLeads = filteredLeads.filter((lead) => {
            const leadDate = new Date(lead.created_at);
            return leadDate >= weekStart && leadDate <= weekEndDay;
          });

          // Para fechados, usar closed_at
          const weekFechados = leadsClosedInPeriod.filter((l) => {
            if (!l.closed_at) return false;
            const closedDate = new Date(l.closed_at);
            return closedDate >= weekStart && closedDate <= weekEndDay;
          });

          weeks.push({
            name: `Sem ${weekNum}`,
            leads: weekLeads.length,
            fechados: weekFechados.length,
          });

          d.setDate(d.getDate() + 7);
          weekNum++;
        }

        return weeks;
      }

      default:
        return [];
    }
  };

  const performanceData = generatePerformanceData();

  // Dados do donut de conversão
  // Em andamento = leads criados no período que NÃO foram fechados no período
  const emAndamento = Math.max(0, totalLeads - fechados);
  const conversionData = [
    { name: 'Fechados', value: fechados, color: 'hsl(var(--chart-2))' },
    { name: 'Em andamento', value: emAndamento, color: 'hsl(var(--chart-1))' },
  ];

  // Funil Outbound (aba separada)
  const outboundStages = [
    { label: 'Triagem',            count: triagem },
    { label: 'Extraídos',          count: outboundAtivos },
    { label: 'Abordados',          count: outboundAbordados },
    { label: 'Retornaram contato', count: outboundRetornaram },
    { label: 'Conversão',          count: outboundReuniao },
    { label: 'Fechados',           count: outboundFechados },
  ];

  // Dados do funil principal (sem Outbound — fica na aba própria)
  const funnelStages = [
    {
      label: 'Lead novo',
      count: filteredLeads.filter((l) => l.status === 'Lead novo').length,
      color: 'bg-blue-500',
    },
    {
      label: 'Em contato',
      count: filteredLeads.filter((l) => l.status === 'Em contato').length,
      color: 'bg-purple-400',
    },
    {
      label: 'Interessado',
      count: filteredLeads.filter((l) => l.status === 'Interessado').length,
      color: 'bg-purple-500',
    },
    {
      label: 'Proposta enviada',
      count: filteredLeads.filter((l) => l.status === 'Proposta enviada').length,
      color: 'bg-purple-600',
    },
    {
      label: 'Fechado',
      count: fechados,
      color: 'bg-zinc-700',
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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <h1 className="text-3xl font-bold text-foreground">Overview</h1>
        <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => handlePeriodChange('today')}
              className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                selectedPeriod === 'today'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80'
              }`}
            >
              Hoje
            </button>
            <button
              onClick={() => handlePeriodChange('week')}
              className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                selectedPeriod === 'week'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80'
              }`}
            >
              Semana
            </button>
            <button
              onClick={() => handlePeriodChange('month')}
              className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                selectedPeriod === 'month'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80'
              }`}
            >
              Mês
            </button>
            <button
              onClick={() => handlePeriodChange('year')}
              className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                selectedPeriod === 'year'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80'
              }`}
            >
              Ano
            </button>
            <button
              onClick={() => handlePeriodChange('custom')}
              className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                selectedPeriod === 'custom'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80'
              }`}
            >
              Personalizado
            </button>
          </div>
          {showDatePicker && (
            <div className="w-full sm:w-auto">
              <DateRangePicker date={dateRange} onDateChange={setDateRange} />
            </div>
          )}
        </div>
      </div>

      {/* Cards de Métricas */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        <MetricCard
          title="Outbound IA"
          value={outboundAtivos}
          subtitle="Leads em prospecção"
          icon={Bot}
          format="number"
        />
        <MetricCard
          title="Novos leads"
          value={novosLeads}
          subtitle={`${novosLeads} novos leads`}
          icon={UserRoundPlus}
          format="number"
        />
        <MetricCard
          title="Em atendimento"
          value={emAtendimento}
          subtitle="Leads em atendimento"
          icon={MessageCircleMore}
          format="number"
        />
        <MetricCard
          title="Taxa de conversão"
          value={taxaConversao}
          subtitle="Leads convertidos"
          icon={TrendingUp}
          format="percentage"
        />
        <MetricCard
          title="Em negociação"
          value={faturamentoEmNegociacao}
          subtitle="Valor em pipeline"
          icon={Users}
          format="currency"
        />
        <MetricCard
          title="Faturamento"
          value={faturamento}
          subtitle="Faturamento em negócios"
          icon={CircleDollarSign}
          format="currency"
        />
      </div>

      {/* Performance e Taxa de Conversão - alinhados */}
      <div className="grid gap-6 lg:grid-cols-3 items-stretch">
        <div className="lg:col-span-2 h-full">
          <PerformanceChart data={performanceData} />
        </div>
        <div className="h-full">
          <ConversionDonut data={conversionData} />
        </div>
      </div>

      {/* Funil de Vendas (com abas) e Vendas Recentes */}
      <div className="grid gap-6 lg:grid-cols-3 items-start">
        <div className="lg:col-span-2 h-[500px]">
          <SalesFunnelTabs
            stages={funnelStages}
            outboundStages={outboundStages}
            antiNoshowCounts={antiNoshowCounts}
          />
        </div>
        <div className="h-[500px]">
          <RecentSales />
        </div>
      </div>
    </div>
  );
}
