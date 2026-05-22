'use client';

import { useState, useEffect, useCallback } from 'react';
import { startOfDay, startOfWeek, startOfMonth, startOfYear, endOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  Send,
  MessageSquare,
  TrendingUp,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  RefreshCw,
  CheckCircle2,
  XCircle,
  ChevronRight,
} from 'lucide-react';
import { FilterPeriod } from '@/components/dashboard/FilterButtons';
import { DateRangePicker } from '@/components/dashboard/DateRangePicker';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DateRange { from: Date | undefined; to: Date | undefined; }

interface MetricasData {
  periodo: string;
  overview: {
    total_enviados: number;
    total_falhas: number;
    total_responderam: number;
    taxa_resposta: number;
    sequencias_ativas: number;
    trials_ativos: number;
    leads_remarketing: number;
    leads_frios: number;
    delta_enviados: number;
    delta_responderam: number;
    delta_taxa_resposta: number;
    delta_trials: number;
  };
  funil: Array<{ etapa: string; count: number; pct: number }>;
  por_dia: Array<{ data: string; enviados: number; falhas: number; responderam: number }>;
  por_tipo: Array<{
    tipo: string;
    label: string;
    enviados: number;
    falhas: number;
    responderam: number;
    taxa_resposta: number;
  }>;
  ranking_sequencias: Array<{
    id: string;
    nome: string;
    tipo: string;
    label: string;
    enviados: number;
    falhas: number;
    responderam: number;
    taxa_resposta: number;
  }>;
  trial: {
    ativos: number;
    expirados: number;
    convertidos: number;
    conversion_rate: number;
    avg_days_to_convert: number;
    lista: Array<{
      id: string;
      nome: string;
      whatsapp: string;
      status: string;
      criado_em: string;
      trial_days: number;
    }>;
    expirando: Array<{
      id: string;
      nome: string;
      trial_days: number;
      criado_em: string;
    }>;
  };
  ultimas_execucoes: Array<{
    id: string;
    tipo: string;
    label: string;
    lead_name: string;
    lead_status: string;
    lead_whatsapp: string;
    mensagem: string;
    enviado_em: string;
    respondeu: boolean;
    resposta: string | null;
  }>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtNum(n: number) {
  return n.toLocaleString('pt-BR');
}

function fmtRelTime(iso: string): string {
  if (!iso) return '—';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'agora';
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function fmtDate(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  });
}

function initial(name: string): string {
  return (name || '?').trim().charAt(0).toUpperCase();
}

const TIPO_COLORS: Record<string, string> = {
  follow_up: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  remarketing: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  trial: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  anti_noshow: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
};

function tipoBadgeClass(tipo: string): string {
  return (
    TIPO_COLORS[tipo] ??
    'bg-muted text-muted-foreground'
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Sk({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-muted', className)} />;
}

function PageSkeleton() {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Sk key={i} className="h-28" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-5">
        <Sk className="lg:col-span-3 h-56" />
        <Sk className="lg:col-span-2 h-56" />
      </div>
      <Sk className="h-44" />
      <Sk className="h-64" />
      <Sk className="h-72" />
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function DeltaBadge({ value, suffix = '%' }: { value: number; suffix?: string }) {
  if (value === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
        <Minus className="h-3 w-3" />
        0{suffix}
      </span>
    );
  }
  const positive = value > 0;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-xs font-medium',
        positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400',
      )}
    >
      {positive ? (
        <ArrowUpRight className="h-3 w-3" />
      ) : (
        <ArrowDownRight className="h-3 w-3" />
      )}
      {positive ? '+' : ''}{value}{suffix}
    </span>
  );
}

interface KpiCardProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  delta?: number;
  deltaSuffix?: string;
  sub?: string;
  accent?: boolean;
}

function KpiCard({ icon: Icon, label, value, delta, deltaSuffix = '%', sub, accent }: KpiCardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-border bg-card p-5 flex flex-col gap-3',
        accent && 'border-primary/30 bg-primary/5',
      )}
    >
      <div className="flex items-center justify-between">
        <div
          className={cn(
            'h-8 w-8 rounded-xl flex items-center justify-center',
            accent ? 'bg-primary/15' : 'bg-muted',
          )}
        >
          <Icon className={cn('h-4 w-4', accent ? 'text-primary' : 'text-muted-foreground')} />
        </div>
        {delta !== undefined && <DeltaBadge value={delta} suffix={deltaSuffix} />}
      </div>
      <div>
        <p className="text-2xl font-bold tracking-tight text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
        {sub && <p className="text-[10px] text-muted-foreground/60 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Funil ────────────────────────────────────────────────────────────────────

function Funil({ data }: { data: MetricasData['funil'] }) {
  const max = data[0]?.count ?? 1;
  return (
    <div className="space-y-3">
      {data.map((step) => {
        const pct = max > 0 ? Math.max((step.count / max) * 100, 2) : 2;
        return (
          <div key={step.etapa}>
            <div className="flex items-center justify-between mb-1.5 text-sm">
              <span className="text-muted-foreground">{step.etapa}</span>
              <div className="flex items-center gap-3 text-xs">
                <span className="font-semibold text-foreground">
                  {fmtNum(step.count)}
                </span>
                <span className="text-muted-foreground w-9 text-right">
                  {step.pct}%
                </span>
              </div>
            </div>
            <div className="h-5 rounded-md bg-muted overflow-hidden">
              <div
                className="h-full rounded-md bg-primary/80 transition-all duration-700"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Bar chart (Tailwind-based) ───────────────────────────────────────────────

function BarChartDay({ data }: { data: MetricasData['por_dia'] }) {
  const maxVal = Math.max(...data.map((d) => d.enviados + d.falhas), 1);

  return (
    <div className="flex items-end gap-1 h-36 w-full">
      {data.map((d, i) => {
        const totalH = Math.max(((d.enviados + d.falhas) / maxVal) * 100, 1);
        const respH = d.enviados + d.falhas > 0
          ? (d.responderam / (d.enviados + d.falhas)) * totalH
          : 0;

        return (
          <div
            key={i}
            className="flex-1 flex flex-col items-center gap-0.5 group relative"
            title={`${d.data}: ${fmtNum(d.enviados)} env, ${fmtNum(d.responderam)} resp`}
          >
            {/* tooltip */}
            <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col items-center z-10 pointer-events-none">
              <div className="bg-popover border border-border rounded-lg px-2.5 py-1.5 text-[10px] text-popover-foreground shadow whitespace-nowrap space-y-0.5">
                <p className="font-semibold">{d.data}</p>
                <p className="text-muted-foreground">Env: {fmtNum(d.enviados)}</p>
                <p className="text-muted-foreground">Resp: {fmtNum(d.responderam)}</p>
                {d.falhas > 0 && <p className="text-red-400">Falhas: {fmtNum(d.falhas)}</p>}
              </div>
              <div className="h-1.5 w-px bg-border" />
            </div>

            {/* bars */}
            <div
              className="w-full rounded-sm flex flex-col justify-end overflow-hidden bg-muted/60"
              style={{ height: `${totalH}%`, minHeight: '4px' }}
            >
              <div
                className="w-full bg-primary/60 rounded-sm transition-all"
                style={{ height: `${respH > 0 ? (respH / totalH) * 100 : 0}%`, minHeight: respH > 0 ? '2px' : '0' }}
              />
            </div>

            {/* date label — show every Nth */}
            {(i === 0 || i === Math.floor(data.length / 2) || i === data.length - 1) && (
              <span className="text-[9px] text-muted-foreground/70 truncate max-w-full">
                {fmtDate(d.data)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Por tipo table ───────────────────────────────────────────────────────────

function PorTipoTable({ data }: { data: MetricasData['por_tipo'] }) {
  if (!data.length) return null;
  const sorted = [...data].sort((a, b) => b.enviados - a.enviados);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="pb-2.5 pr-4 text-xs font-medium text-muted-foreground">Sequência</th>
            <th className="pb-2.5 px-4 text-xs font-medium text-muted-foreground text-right">Enviados</th>
            <th className="pb-2.5 px-4 text-xs font-medium text-muted-foreground text-right">Falhas</th>
            <th className="pb-2.5 px-4 text-xs font-medium text-muted-foreground text-right">Responderam</th>
            <th className="pb-2.5 pl-4 text-xs font-medium text-muted-foreground text-right">Taxa</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((t) => (
            <tr key={t.tipo} className="border-b border-border/50 last:border-0">
              <td className="py-3 pr-4">
                <span
                  className={cn(
                    'inline-flex px-2 py-0.5 rounded-md text-[11px] font-medium',
                    tipoBadgeClass(t.tipo),
                  )}
                >
                  {t.label}
                </span>
              </td>
              <td className="py-3 px-4 text-right text-muted-foreground">
                {fmtNum(t.enviados)}
              </td>
              <td className="py-3 px-4 text-right text-red-400 dark:text-red-500">
                {t.falhas > 0 ? fmtNum(t.falhas) : <span className="text-muted-foreground/30">—</span>}
              </td>
              <td className="py-3 px-4 text-right text-emerald-600 dark:text-emerald-400">
                {fmtNum(t.responderam)}
              </td>
              <td className="py-3 pl-4 text-right">
                <span className="font-semibold text-foreground">{t.taxa_resposta}%</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Ranking sequências ───────────────────────────────────────────────────────

function RankingSequencias({ data }: { data: MetricasData['ranking_sequencias'] }) {
  if (!data.length) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Sem dados no período
      </p>
    );
  }

  const sorted = [...data].sort((a, b) => b.taxa_resposta - a.taxa_resposta);

  return (
    <div className="space-y-4">
      {sorted.map((s, i) => (
        <div key={s.id} className="flex items-center gap-4">
          <span className="text-base font-bold text-muted-foreground/25 w-7 shrink-0 text-right">
            {i + 1}
          </span>
          <div className="flex-1 space-y-1.5 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-medium text-sm truncate">{s.nome}</span>
                <span
                  className={cn(
                    'shrink-0 text-[10px] px-1.5 py-0.5 rounded font-medium',
                    tipoBadgeClass(s.tipo),
                  )}
                >
                  {s.label}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs shrink-0">
                <span className="text-muted-foreground hidden sm:inline">
                  {fmtNum(s.enviados)} env
                </span>
                <span className="text-emerald-600 dark:text-emerald-400 hidden sm:inline">
                  {fmtNum(s.responderam)} resp
                </span>
                <span className="font-bold text-foreground w-10 text-right">
                  {s.taxa_resposta}%
                </span>
              </div>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-700"
                style={{ width: `${Math.min(s.taxa_resposta, 100)}%` }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Últimas execuções ────────────────────────────────────────────────────────

function UltimasExecucoes({ data }: { data: MetricasData['ultimas_execucoes'] }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (!data.length) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Nenhuma execução no período
      </p>
    );
  }

  return (
    <div className="divide-y divide-border/50">
      {data.map((ex) => {
        const key = `${ex.tipo}-${ex.id}`;
        const isOpen = expanded === key;
        return (
          <button
            key={key}
            className="w-full text-left py-3 px-1 flex items-start gap-3 hover:bg-muted/30 rounded-xl transition-colors group"
            onClick={() => setExpanded(isOpen ? null : key)}
          >
            {/* Avatar */}
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary font-semibold text-sm">
              {initial(ex.lead_name)}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 space-y-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm text-foreground">
                  {ex.lead_name}
                </span>
                <span
                  className={cn(
                    'text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0',
                    tipoBadgeClass(ex.tipo),
                  )}
                >
                  {ex.label}
                </span>
              </div>
              <p className={cn('text-xs text-muted-foreground truncate', isOpen && 'whitespace-normal line-clamp-none')}>
                {ex.mensagem}
              </p>
              {isOpen && ex.resposta && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg px-2.5 py-1.5 mt-1.5">
                  <span className="font-semibold">Resposta: </span>{ex.resposta}
                </p>
              )}
            </div>

            {/* Right side */}
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <span className="text-[10px] text-muted-foreground">
                {fmtRelTime(ex.enviado_em)}
              </span>
              {ex.respondeu ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              ) : (
                <XCircle className="h-4 w-4 text-muted-foreground/25" />
              )}
              <ChevronRight
                className={cn(
                  'h-3 w-3 text-muted-foreground/40 transition-transform',
                  isOpen && 'rotate-90',
                )}
              />
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ─── Section card wrapper ─────────────────────────────────────────────────────

function Section({
  title,
  subtitle,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('rounded-2xl border border-border bg-card p-6', className)}>
      <div className="mb-5">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        )}
      </div>
      {children}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const PERIOD_LABELS: Record<FilterPeriod, string> = {
  today: 'Hoje', week: 'Semana', month: 'Mês', year: 'Ano', custom: 'Personalizado',
};
const PERIODS: FilterPeriod[] = ['today', 'week', 'month', 'year', 'custom'];

function getPeriodRange(period: FilterPeriod, dr?: DateRange): { from: Date; to: Date } {
  const now = new Date();
  if (period === 'custom' && dr?.from && dr?.to) return { from: startOfDay(dr.from), to: endOfDay(dr.to) };
  if (period === 'today') return { from: startOfDay(now), to: endOfDay(now) };
  if (period === 'week') return { from: startOfWeek(now, { weekStartsOn: 0 }), to: endOfDay(now) };
  if (period === 'year') return { from: startOfYear(now), to: endOfDay(now) };
  return { from: startOfMonth(now), to: endOfDay(now) };
}

export default function MetricasPage() {
  const [selectedPeriod, setSelectedPeriod] = useState<FilterPeriod>('month');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [data, setData] = useState<MetricasData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (period: FilterPeriod, dr?: DateRange) => {
    setLoading(true);
    setError(null);
    try {
      const { from, to } = getPeriodRange(period, dr);
      const res = await fetch(`/api/metricas?from=${from.toISOString()}&to=${to.toISOString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Erro ao carregar métricas');
      setData(json);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }, []);

  const handlePeriodChange = (period: FilterPeriod) => {
    setSelectedPeriod(period);
    if (period !== 'custom') { setDateRange(undefined); setShowDatePicker(false); load(period); }
    else setShowDatePicker(true);
  };

  useEffect(() => {
    load('month');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="max-w-6xl mx-auto space-y-8 py-2 pb-16">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Métricas</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Follow-up · Trial SaaS · Remarketing
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
          <div className="flex gap-1 bg-muted p-1 rounded-xl">
            {PERIODS.map((period) => (
              <button
                key={period}
                onClick={() => handlePeriodChange(period)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-150 whitespace-nowrap',
                  selectedPeriod === period
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {PERIOD_LABELS[period]}
              </button>
            ))}
          </div>
          {showDatePicker && (
            <DateRangePicker
              date={dateRange}
              onDateChange={(dr) => {
                setDateRange(dr);
                if (dr?.from && dr?.to) load('custom', dr);
              }}
            />
          )}
          <button
            onClick={() => load(selectedPeriod, dateRange)}
            disabled={loading}
            className="h-9 w-9 rounded-xl border border-border bg-card flex items-center justify-center hover:bg-muted/50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-4 w-4 text-muted-foreground', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* ── Loading ─────────────────────────────────────────────────────────── */}
      {loading && !data && <PageSkeleton />}

      {/* ── Error ───────────────────────────────────────────────────────────── */}
      {error && (
        <div className="rounded-2xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-900/10 p-5">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      {data && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard
              icon={Send}
              label="Enviados"
              value={fmtNum(data.overview.total_enviados)}
              delta={data.overview.delta_enviados}
              sub="no período"
            />
            <KpiCard
              icon={MessageSquare}
              label="Responderam"
              value={fmtNum(data.overview.total_responderam)}
              delta={data.overview.delta_responderam}
              sub="no período"
            />
            <KpiCard
              icon={TrendingUp}
              label="Taxa de resposta"
              value={`${data.overview.taxa_resposta}%`}
              delta={data.overview.delta_taxa_resposta}
              sub="do total enviado"
              accent
            />
            <KpiCard
              icon={Target}
              label="Trials ativos"
              value={fmtNum(data.overview.trials_ativos)}
              delta={data.overview.delta_trials}
              sub="em período de teste"
            />
          </div>

          {/* Gráfico + Funil */}
          <div className="grid gap-6 lg:grid-cols-5">
            <Section
              title="Disparos por dia"
              subtitle="Enviados vs responderam"
              className="lg:col-span-3"
            >
              {data.por_dia.length > 0 ? (
                <>
                  <BarChartDay data={data.por_dia} />
                  <div className="flex items-center gap-5 mt-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-sm bg-muted-foreground/30 inline-block" />
                      Enviados
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-sm bg-primary/60 inline-block" />
                      Responderam
                    </span>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-10">
                  Sem dados no período
                </p>
              )}
            </Section>

            <Section
              title="Funil de conversão"
              subtitle="Etapas do pipeline"
              className="lg:col-span-2"
            >
              {data.funil.length > 0 ? (
                <Funil data={data.funil} />
              ) : (
                <p className="text-sm text-muted-foreground text-center py-10">
                  Sem dados no período
                </p>
              )}
            </Section>
          </div>

          {/* Por tipo */}
          {data.por_tipo.length > 0 && (
            <Section
              title="Por tipo de sequência"
              subtitle="Desempenho de cada fluxo de automação"
            >
              <PorTipoTable data={data.por_tipo} />
            </Section>
          )}

          {/* Ranking sequências */}
          <Section
            title="Ranking de sequências"
            subtitle="Ordenado por taxa de resposta"
          >
            <RankingSequencias data={data.ranking_sequencias} />
          </Section>

          {/* Últimas execuções */}
          <Section
            title="Últimas execuções"
            subtitle="Histórico recente de disparos"
          >
            <UltimasExecucoes data={data.ultimas_execucoes} />
          </Section>
        </>
      )}

    </div>
  );
}

