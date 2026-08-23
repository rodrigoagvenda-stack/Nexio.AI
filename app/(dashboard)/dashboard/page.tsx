'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { UserRoundPlus, MessageCircleMore, TrendingUp, Users, CircleDollarSign } from 'lucide-react';
import {
  startOfDay, startOfWeek, startOfMonth, startOfYear,
  endOfDay, subDays, subWeeks, subMonths, subYears, format,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { FilterPeriod } from '@/components/dashboard/FilterButtons';
import { DateRangePicker } from '@/components/dashboard/DateRangePicker';
import { PerformanceChart } from '@/components/dashboard/PerformanceChart';
import { ConversionDonut } from '@/components/dashboard/ConversionDonut';
import { SalesFunnelTabs } from '@/components/dashboard/SalesFunnelTabs';
import { RecentSales } from '@/components/dashboard/RecentSales';
import { useFeatures } from '@/components/layout/FeaturesProvider';

interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

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

// ── Pure helpers ──────────────────────────────────────────────────────────────

function getPeriodRange(period: FilterPeriod, dateRange?: DateRange): { from: Date; to: Date } | null {
  const now = new Date();
  if (period === 'custom') {
    return dateRange?.from && dateRange?.to
      ? { from: startOfDay(dateRange.from), to: endOfDay(dateRange.to) }
      : null;
  }
  const map: Record<string, { from: Date; to: Date }> = {
    today: { from: startOfDay(now), to: endOfDay(now) },
    week:  { from: startOfWeek(now, { weekStartsOn: 0 }), to: endOfDay(now) },
    month: { from: startOfMonth(now), to: endOfDay(now) },
    year:  { from: startOfYear(now), to: endOfDay(now) },
  };
  return map[period] ?? null;
}

function getPreviousPeriodRange(period: FilterPeriod, dateRange?: DateRange): { from: Date; to: Date } | null {
  const now = new Date();
  switch (period) {
    case 'today': {
      const d = subDays(now, 1);
      return { from: startOfDay(d), to: endOfDay(d) };
    }
    case 'week': {
      const ws = startOfWeek(now, { weekStartsOn: 0 });
      return { from: subWeeks(ws, 1), to: endOfDay(subDays(ws, 1)) };
    }
    case 'month': {
      const ms = startOfMonth(now);
      return { from: startOfMonth(subMonths(now, 1)), to: endOfDay(subDays(ms, 1)) };
    }
    case 'year': {
      const ys = startOfYear(now);
      return { from: startOfYear(subYears(now, 1)), to: endOfDay(subDays(ys, 1)) };
    }
    case 'custom': {
      if (!dateRange?.from || !dateRange?.to) return null;
      const diff = dateRange.to.getTime() - dateRange.from.getTime();
      const prevTo = endOfDay(subDays(dateRange.from, 1));
      const prevFrom = new Date(prevTo.getTime() - diff);
      return { from: prevFrom, to: prevTo };
    }
    default:
      return null;
  }
}

function calcDelta(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 100);
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

const PERIOD_LABELS: Record<FilterPeriod, string> = {
  today: 'Hoje', week: 'Semana', month: 'Mês', year: 'Ano', custom: 'Personalizado',
};

const PERIODS: FilterPeriod[] = ['today', 'week', 'month', 'year', 'custom'];

// ── Component ─────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const features = useFeatures();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [antiNoshowCounts, setAntiNoshowCounts] = useState<Record<string, number>>({});
  const [companyName, setCompanyName] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState<FilterPeriod>('month');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    fetchData();
    const onVisible = () => { if (!document.hidden) fetchData(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  async function fetchData() {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData } = await supabase
        .from('users').select('company_id').eq('auth_user_id', user.id).single();
      if (!userData?.company_id) return;
      const companyId = userData.company_id;

      const [leadsRes, followLogsRes, companyRes] = await Promise.all([
        supabase.from('leads')
          .select('id, status, project_value, created_at, closed_at, outbound_responded, outbound_meeting, outbound_followups')
          .eq('company_id', companyId)
          .order('created_at', { ascending: true }),
        supabase.from('follow_logs').select('momento').eq('company_id', companyId),
        supabase.from('companies').select('name').eq('id', companyId).maybeSingle(),
      ]);

      setLeads(leadsRes.data || []);
      setCompanyName(companyRes.data?.name || '');

      const counts: Record<string, number> = {};
      (followLogsRes.data || []).forEach((r: any) => {
        if (r.momento) counts[r.momento] = (counts[r.momento] || 0) + 1;
      });
      setAntiNoshowCounts(counts);
    } catch (e) {
      console.error('Dashboard fetch error:', e);
    } finally {
      setLoading(false);
    }
  }

  const handlePeriodChange = (period: FilterPeriod) => {
    setSelectedPeriod(period);
    if (period !== 'custom') { setDateRange(undefined); setShowDatePicker(false); }
    else { setShowDatePicker(true); }
  };

  // ── Ranges ────────────────────────────────────────────────────────────────
  const currentRange = useMemo(() => getPeriodRange(selectedPeriod, dateRange), [selectedPeriod, dateRange]);
  const previousRange = useMemo(() => getPreviousPeriodRange(selectedPeriod, dateRange), [selectedPeriod, dateRange]);

  // ── Derived lead sets ─────────────────────────────────────────────────────
  const filteredLeads = useMemo(() => {
    if (!currentRange) return leads;
    return leads.filter(l => {
      const d = new Date(l.created_at);
      return d >= currentRange.from && d <= currentRange.to;
    });
  }, [leads, currentRange]);

  const leadsClosedInPeriod = useMemo(() => {
    if (!currentRange) return leads.filter(l => l.status === 'Fechado' && l.closed_at);
    return leads.filter(l => {
      if (l.status !== 'Fechado' || !l.closed_at) return false;
      const d = new Date(l.closed_at);
      return d >= currentRange.from && d <= currentRange.to;
    });
  }, [leads, currentRange]);

  // Leads not closed/lost : state atual do pipeline (independe do período)
  const activeLeads = useMemo(() =>
    leads.filter(l => l.status !== 'Fechado' && l.status !== 'Perdido'),
    [leads]
  );

  const prevFilteredLeads = useMemo(() => {
    if (!previousRange) return [];
    return leads.filter(l => {
      const d = new Date(l.created_at);
      return d >= previousRange.from && d <= previousRange.to;
    });
  }, [leads, previousRange]);

  const prevLeadsClosedInPeriod = useMemo(() => {
    if (!previousRange) return [];
    return leads.filter(l => {
      if (l.status !== 'Fechado' || !l.closed_at) return false;
      const d = new Date(l.closed_at);
      return d >= previousRange.from && d <= previousRange.to;
    });
  }, [leads, previousRange]);

  // ── Current metrics ───────────────────────────────────────────────────────
  // novosLeads: TODOS os leads criados no período (independente do status atual)
  const novosLeads = filteredLeads.length;
  // emAtendimento: estado real do pipeline agora
  const emAtendimento = activeLeads.filter(l => l.status === 'Em contato').length;
  const fechados = leadsClosedInPeriod.length;
  const faturamento = leadsClosedInPeriod.reduce((s, l) => s + (l.project_value || 0), 0);
  // pipeline: valor total de leads ainda ativos (estado atual, independe do período)
  const faturamentoEmNegociacao = activeLeads.reduce((s, l) => s + (l.project_value || 0), 0);
  const taxaConversao = filteredLeads.length > 0
    ? Math.min(100, (fechados / filteredLeads.length) * 100).toFixed(1)
    : '0.0';

  // ── Previous period metrics ───────────────────────────────────────────────
  const prevNovosLeads = prevFilteredLeads.length;
  const prevFechados = prevLeadsClosedInPeriod.length;
  const prevFaturamento = prevLeadsClosedInPeriod.reduce((s, l) => s + (l.project_value || 0), 0);
  const prevTaxaConversao = prevFilteredLeads.length > 0
    ? (prevFechados / prevFilteredLeads.length) * 100 : 0;

  // ── Deltas ────────────────────────────────────────────────────────────────
  const deltaNovosLeads = calcDelta(novosLeads, prevNovosLeads);
  const deltaFechados = calcDelta(fechados, prevFechados);
  const deltaFaturamento = calcDelta(faturamento, prevFaturamento);
  const deltaTaxaConversao = calcDelta(parseFloat(taxaConversao), prevTaxaConversao);
  const deltaEmAtendimento = calcDelta(
    filteredLeads.filter(l => l.status === 'Em contato').length,
    prevFilteredLeads.filter(l => l.status === 'Em contato').length
  );

  // ── Performance chart data ────────────────────────────────────────────────
  const performanceData = useMemo(() => {
    const now = new Date();
    switch (selectedPeriod) {
      case 'today': {
        return Array.from({ length: 24 }, (_, i) => ({
          name: `${i}h`,
          leads: filteredLeads.filter(l => new Date(l.created_at).getHours() === i).length,
          fechados: leadsClosedInPeriod.filter(l => l.closed_at && new Date(l.closed_at).getHours() === i).length,
        }));
      }
      case 'week': {
        const ws = startOfWeek(now, { weekStartsOn: 0 });
        return Array.from({ length: 7 }, (_, i) => {
          const d = new Date(ws); d.setDate(d.getDate() + i);
          const ds = startOfDay(d), de = endOfDay(d);
          return {
            name: d.toLocaleDateString('pt-BR', { weekday: 'short' }),
            leads: filteredLeads.filter(l => { const ld = new Date(l.created_at); return ld >= ds && ld <= de; }).length,
            fechados: leadsClosedInPeriod.filter(l => {
              if (!l.closed_at) return false;
              const cd = new Date(l.closed_at); return cd >= ds && cd <= de;
            }).length,
          };
        });
      }
      case 'month': {
        const ms = startOfMonth(now);
        const weeks: { name: string; leads: number; fechados: number }[] = [];
        let wn = 1;
        for (let d = new Date(ms); d <= now; ) {
          const ws2 = startOfDay(d);
          const we2 = endOfDay(new Date(d.getTime() + 6 * 86400000));
          weeks.push({
            name: `Sem ${wn}`,
            leads: filteredLeads.filter(l => { const ld = new Date(l.created_at); return ld >= ws2 && ld <= we2; }).length,
            fechados: leadsClosedInPeriod.filter(l => {
              if (!l.closed_at) return false;
              const cd = new Date(l.closed_at); return cd >= ws2 && cd <= we2;
            }).length,
          });
          d.setDate(d.getDate() + 7); wn++;
        }
        return weeks.length > 0 ? weeks : [{ name: 'Sem 1', leads: 0, fechados: 0 }];
      }
      case 'year': {
        return Array.from({ length: 12 }, (_, i) => {
          const mn = new Date(now.getFullYear(), i, 1).toLocaleDateString('pt-BR', { month: 'short' });
          return {
            name: mn.charAt(0).toUpperCase() + mn.slice(1),
            leads: filteredLeads.filter(l => new Date(l.created_at).getMonth() === i).length,
            fechados: leadsClosedInPeriod.filter(l => l.closed_at && new Date(l.closed_at).getMonth() === i).length,
          };
        });
      }
      case 'custom': {
        if (!dateRange?.from || !dateRange?.to) return [{ name: 'Selecione um período', leads: 0, fechados: 0 }];
        const diff = Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / 86400000);
        if (diff <= 7) {
          return Array.from({ length: diff + 1 }, (_, i) => {
            const d = new Date(dateRange.from!); d.setDate(d.getDate() + i);
            const ds = startOfDay(d), de = endOfDay(d);
            return {
              name: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
              leads: filteredLeads.filter(l => { const ld = new Date(l.created_at); return ld >= ds && ld <= de; }).length,
              fechados: leadsClosedInPeriod.filter(l => {
                if (!l.closed_at) return false;
                const cd = new Date(l.closed_at); return cd >= ds && cd <= de;
              }).length,
            };
          });
        }
        const weeks2: { name: string; leads: number; fechados: number }[] = [];
        let wn2 = 1;
        for (let d = new Date(dateRange.from); d <= dateRange.to; ) {
          const ws3 = startOfDay(d);
          const we3 = endOfDay(new Date(Math.min(d.getTime() + 6 * 86400000, dateRange.to.getTime())));
          weeks2.push({
            name: `Sem ${wn2}`,
            leads: filteredLeads.filter(l => { const ld = new Date(l.created_at); return ld >= ws3 && ld <= we3; }).length,
            fechados: leadsClosedInPeriod.filter(l => {
              if (!l.closed_at) return false;
              const cd = new Date(l.closed_at); return cd >= ws3 && cd <= we3;
            }).length,
          });
          d.setDate(d.getDate() + 7); wn2++;
        }
        return weeks2;
      }
      default:
        return [];
    }
  }, [selectedPeriod, dateRange, filteredLeads, leadsClosedInPeriod]);

  // ── Radial conversion (period-based) ─────────────────────────────────────
  const allFechados = leads.filter(l => l.status === 'Fechado').length;
  const radialEmAndamento = filteredLeads.filter(l => l.status !== 'Fechado' && l.status !== 'Perdido').length;

  // ── Funnel (current pipeline state) ──────────────────────────────────────
  const remarketingCount = leads.filter(l => l.status === 'Remarketing').length;
  const funnelStages = [
    { label: 'Triagem',          count: activeLeads.filter(l => l.status === 'Triagem').length,          color: 'bg-slate-500' },
    { label: 'Lead novo',        count: activeLeads.filter(l => l.status === 'Lead novo').length,        color: 'bg-blue-500' },
    { label: 'Em contato',       count: activeLeads.filter(l => l.status === 'Em contato').length,       color: 'bg-green-400' },
    { label: 'Interessado',      count: activeLeads.filter(l => l.status === 'Interessado').length,      color: 'bg-green-500' },
    { label: 'Proposta enviada', count: activeLeads.filter(l => l.status === 'Proposta enviada').length, color: 'bg-green-600' },
    { label: 'Remarketing',      count: remarketingCount,                                                  color: 'bg-amber-500' },
    { label: 'Fechado',          count: allFechados,                                                       color: 'bg-zinc-700' },
  ];

  // ── Header date ───────────────────────────────────────────────────────────
  const formattedDate = (() => {
    const s = format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR });
    return s.charAt(0).toUpperCase() + s.slice(1);
  })();

  // ── Skeleton ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="space-y-2">
            <div className="h-8 w-56 animate-pulse bg-muted rounded-lg" />
            <div className="h-4 w-64 animate-pulse bg-muted rounded-lg" />
          </div>
          <div className="h-10 w-80 animate-pulse bg-muted rounded-xl" />
        </div>
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
          {[...Array(5)].map((_, i) => <div key={i} className="h-28 animate-pulse bg-muted rounded-xl" />)}
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 h-72 animate-pulse bg-muted rounded-xl" />
          <div className="h-72 animate-pulse bg-muted rounded-xl" />
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 h-64 animate-pulse bg-muted rounded-xl" />
          <div className="h-64 animate-pulse bg-muted rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">
            {getGreeting()}{companyName ? `, ${companyName}` : ''}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{formattedDate}</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 items-center sm:items-center">
          <div className="flex items-center rounded-full p-1 bg-muted">
            {PERIODS.map(period => (
              <button
                key={period}
                onClick={() => handlePeriodChange(period)}
                className="px-4 py-1.5 text-xs font-medium rounded-full transition-all duration-150 whitespace-nowrap"
                style={selectedPeriod === period
                  ? { backgroundColor: '#0F3D2B', color: '#fff', fontWeight: 600 }
                  : { color: 'var(--muted-foreground)', background: 'transparent' }
                }
              >
                {PERIOD_LABELS[period]}
              </button>
            ))}
          </div>
          {showDatePicker && (
            <DateRangePicker date={dateRange} onDateChange={setDateRange} />
          )}
        </div>
      </div>


      {/* KPI Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
        <MetricCard
          title="Novos leads"
          value={novosLeads}
          subtitle={`${novosLeads === 1 ? '1 lead' : `${novosLeads} leads`} no período`}
          icon={UserRoundPlus}
          format="number"
          delta={deltaNovosLeads}
        />
        <MetricCard
          title="Em atendimento"
          value={emAtendimento}
          subtitle="Pipeline ativo agora"
          icon={MessageCircleMore}
          format="number"
          delta={deltaEmAtendimento}
        />
        <MetricCard
          title="Taxa de conversão"
          value={taxaConversao}
          subtitle="Fechados / entrados"
          icon={TrendingUp}
          format="percentage"
          delta={deltaTaxaConversao}
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
          subtitle="Fechados no período"
          icon={CircleDollarSign}
          format="currency"
          delta={deltaFaturamento}
        />
      </div>

      {/* Charts */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3 items-stretch min-h-[380px]">
        <div className="lg:col-span-2 h-[320px] md:h-full">
          <PerformanceChart data={performanceData} />
        </div>
        <div className="h-[300px] md:h-full">
          <ConversionDonut
            fechados={fechados}
            emAndamento={radialEmAndamento}
            delta={deltaTaxaConversao}
            periodo={PERIOD_LABELS[selectedPeriod]}
          />
        </div>
      </div>

      {/* Funnel + Recent Sales */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3 items-stretch">
        <div className="lg:col-span-2">
          <SalesFunnelTabs
            stages={funnelStages}
            antiNoshowCounts={antiNoshowCounts}
            remarketingCount={remarketingCount}
            showAntiNoshow={!!features.anti_noshow}
            showRemarketing={!!features.remarketing}
          />
        </div>
        <div className="h-full overflow-hidden">
          <RecentSales />
        </div>
      </div>
    </div>
  );
}
