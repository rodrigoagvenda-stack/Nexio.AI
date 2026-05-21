'use client';

import { useState, useEffect, useCallback } from 'react';
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
  Eye,
  UserX,
  ShieldOff,
  AlertTriangle,
  ChevronLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

// ─── Types ────────────────────────────────────────────────────────────────────

type Periodo = '7d' | '30d' | '90d';

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

const PERIODOS: { value: Periodo; label: string }[] = [
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: '90d', label: '90d' },
];

export default function MetricasPage() {
  const [periodo, setPeriodo] = useState<Periodo>('30d');
  const [data, setData] = useState<MetricasData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (p: Periodo) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/metricas?periodo=${p}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Erro ao carregar métricas');
      setData(json);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(periodo);
  }, [periodo, load]);

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

        <div className="flex items-center gap-2">
          {/* Period selector */}
          <div className="flex items-center rounded-xl border border-border overflow-hidden text-sm bg-card">
            {PERIODOS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setPeriodo(value)}
                className={cn(
                  'px-4 py-1.5 font-medium transition-colors',
                  periodo === value
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground hover:bg-muted/50',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Refresh */}
          <button
            onClick={() => load(periodo)}
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

      {/* ── Agenda de Automações (Trial + Anti-noshow) ─────────────────────── */}
      <AgendaCalendario />

    </div>
  );
}

// ─── Agenda Calendário (Trial + Anti-noshow) ──────────────────────────────────

interface TrialListRecord {
  id: number;
  nome: string;
  email: string;
  whatsapp: string;
  status: string;
  criado_em: string;
  trial_days: number;
}

const MONTH_NAMES_M = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const DAY_NAMES_M = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function MetricasTrialCalendar({ trials }: { trials: TrialListRecord[] }) {
  const [current, setCurrent] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [selected, setSelected] = useState<TrialListRecord | null>(null);

  const year = current.getFullYear();
  const month = current.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const byDay = new Map<string, TrialListRecord[]>();
  for (const t of trials) {
    const exp = new Date(new Date(t.criado_em).getTime() + (t.trial_days ?? 7) * 86_400_000);
    const key = `${exp.getFullYear()}-${exp.getMonth()}-${exp.getDate()}`;
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(t);
  }

  const today = new Date();

  function trialColor(trial: TrialListRecord) {
    const exp = new Date(new Date(trial.criado_em).getTime() + (trial.trial_days ?? 7) * 86_400_000);
    const daysLeft = Math.ceil((exp.getTime() - Date.now()) / 86_400_000);
    if (daysLeft < 0) return 'bg-muted text-muted-foreground';
    if (daysLeft <= 2) return 'bg-red-500/20 text-red-600 border-red-500/30 dark:text-red-400';
    if (daysLeft <= 5) return 'bg-amber-500/20 text-amber-600 border-amber-500/30 dark:text-amber-400';
    return 'bg-emerald-500/20 text-emerald-600 border-emerald-500/30 dark:text-emerald-400';
  }

  const cells: (null | number)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const trialDetailInfo = selected ? (() => {
    const exp = new Date(new Date(selected.criado_em).getTime() + (selected.trial_days ?? 7) * 86_400_000);
    const daysLeft = Math.ceil((exp.getTime() - Date.now()) / 86_400_000);
    const daysGone = (selected.trial_days ?? 7) - Math.max(0, daysLeft);
    const expired = daysLeft < 0;
    return { exp, daysLeft, daysGone, expired };
  })() : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">{MONTH_NAMES_M[month]} {year}</h3>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCurrent(new Date(year, month - 1, 1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCurrent(new Date(year, month + 1, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px bg-border rounded-xl overflow-hidden">
        {DAY_NAMES_M.map((d) => (
          <div key={d} className="bg-muted/40 text-center py-2 text-[11px] font-medium text-muted-foreground">{d}</div>
        ))}
        {cells.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} className="bg-background min-h-[72px]" />;
          const key = `${year}-${month}-${day}`;
          const dayTrials = byDay.get(key) ?? [];
          const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
          return (
            <div key={day} className={cn('bg-background min-h-[72px] p-1.5 space-y-1', isToday && 'bg-primary/5')}>
              <div className={cn('text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full', isToday ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}>
                {day}
              </div>
              {dayTrials.slice(0, 3).map((trial) => (
                <button key={trial.id} onClick={() => setSelected(trial)}
                  className={cn('w-full text-left text-[10px] px-1.5 py-0.5 rounded border truncate transition-all hover:opacity-80', trialColor(trial))}>
                  {trial.nome.split(' ')[0]}
                </button>
              ))}
              {dayTrials.length > 3 && <p className="text-[10px] text-muted-foreground text-center">+{dayTrials.length - 3}</p>}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-emerald-500/20 border border-emerald-500/30" /> &gt;5 dias</div>
        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-amber-500/20 border border-amber-500/30" /> 2-5 dias</div>
        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-red-500/20 border border-red-500/30" /> &lt;2 dias</div>
        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-muted border border-border" /> Expirado</div>
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogContent className="max-w-sm">
          {selected && trialDetailInfo && (
            <>
              <DialogHeader>
                <DialogTitle className="text-base">{selected.nome}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">{selected.email}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={cn('text-xs border',
                    trialDetailInfo.expired ? 'bg-muted text-muted-foreground border-border'
                    : trialDetailInfo.daysLeft <= 2 ? 'bg-red-500/10 text-red-600 border-red-500/20'
                    : trialDetailInfo.daysLeft <= 5 ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                    : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20')}>
                    {trialDetailInfo.expired ? 'Expirado' : trialDetailInfo.daysLeft === 0 ? 'Expira hoje' : `${trialDetailInfo.daysLeft} dias restantes`}
                  </Badge>
                  <span className="text-xs text-muted-foreground">Trial de {selected.trial_days ?? 7} dias</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className={cn('h-full rounded-full transition-all',
                    trialDetailInfo.expired ? 'bg-muted-foreground'
                    : trialDetailInfo.daysLeft <= 2 ? 'bg-red-500'
                    : trialDetailInfo.daysLeft <= 5 ? 'bg-amber-500' : 'bg-emerald-500')}
                    style={{ width: `${Math.min(100, Math.round((trialDetailInfo.daysGone / (selected.trial_days ?? 7)) * 100))}%` }} />
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div><span className="font-medium">WhatsApp: </span>{selected.whatsapp}</div>
                  <div><span className="font-medium">Cadastro: </span>{new Date(selected.criado_em).toLocaleDateString('pt-BR')}</div>
                  <div><span className="font-medium">Expiração: </span>{trialDetailInfo.exp.toLocaleDateString('pt-BR')}</div>
                  <div><span className="font-medium">Progresso: </span>{Math.max(0, trialDetailInfo.daysGone)}/{selected.trial_days ?? 7} dias</div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSelected(null)}>Fechar</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface CallRecord {
  id: number;
  contact_name: string;
  whatsapp: string;
  status: string;
  call_agendada_para: string;
  call_status: string | null;
}

function AntiNoshowCalendar({ calls }: { calls: CallRecord[] }) {
  const [current, setCurrent] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [selected, setSelected] = useState<CallRecord | null>(null);

  const year = current.getFullYear();
  const month = current.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  const byDay = new Map<string, CallRecord[]>();
  for (const c of calls) {
    const d = new Date(c.call_agendada_para);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(c);
  }

  const cells: (null | number)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  function callColor(c: CallRecord) {
    const diff = Math.ceil((new Date(c.call_agendada_para).getTime() - Date.now()) / 86_400_000);
    if (diff < 0) return 'bg-muted text-muted-foreground';
    if (diff === 0) return 'bg-red-500/20 text-red-600 border-red-500/30 dark:text-red-400';
    if (diff <= 1) return 'bg-amber-500/20 text-amber-600 border-amber-500/30 dark:text-amber-400';
    return 'bg-blue-500/20 text-blue-600 border-blue-500/30 dark:text-blue-400';
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">{MONTH_NAMES_M[month]} {year}</h3>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCurrent(new Date(year, month - 1, 1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCurrent(new Date(year, month + 1, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px bg-border rounded-xl overflow-hidden">
        {DAY_NAMES_M.map((d) => (
          <div key={d} className="bg-muted/40 text-center py-2 text-[11px] font-medium text-muted-foreground">{d}</div>
        ))}
        {cells.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} className="bg-background min-h-[72px]" />;
          const key = `${year}-${month}-${day}`;
          const dayCalls = byDay.get(key) ?? [];
          const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
          return (
            <div key={day} className={cn('bg-background min-h-[72px] p-1.5 space-y-1', isToday && 'bg-primary/5')}>
              <div className={cn('text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full', isToday ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}>
                {day}
              </div>
              {dayCalls.slice(0, 3).map((c) => (
                <button key={c.id} onClick={() => setSelected(c)}
                  className={cn('w-full text-left text-[10px] px-1.5 py-0.5 rounded border truncate hover:opacity-80', callColor(c))}>
                  {c.contact_name.split(' ')[0]}
                </button>
              ))}
              {dayCalls.length > 3 && <p className="text-[10px] text-muted-foreground text-center">+{dayCalls.length - 3}</p>}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-blue-500/20 border border-blue-500/30" /> Agendado</div>
        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-amber-500/20 border border-amber-500/30" /> Amanhã</div>
        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-red-500/20 border border-red-500/30" /> Hoje</div>
        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-muted border border-border" /> Passado</div>
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogContent className="max-w-sm">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="text-base">{selected.contact_name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div><span className="font-medium text-foreground">WhatsApp: </span>{selected.whatsapp}</div>
                  <div><span className="font-medium text-foreground">Status CRM: </span>{selected.status}</div>
                  <div><span className="font-medium text-foreground">Call: </span>{new Date(selected.call_agendada_para).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>
                  <div><span className="font-medium text-foreground">Status call: </span>{selected.call_status ?? 'pendente'}</div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSelected(null)}>Fechar</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

type AgendaTab = 'trial' | 'noshow';

function AgendaCalendario() {
  const [tab, setTab] = useState<AgendaTab>('trial');
  const [trials, setTrials] = useState<TrialListRecord[]>([]);
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/trial/list').then((r) => r.ok ? r.json() : { trials: [] }),
      fetch('/api/follow/calls').then((r) => r.ok ? r.json() : { calls: [] }),
    ])
      .then(([t, c]) => { setTrials(t.trials ?? []); setCalls(c.calls ?? []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Agenda de Automações</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Calendário de trials e reuniões agendadas</p>
        </div>
        <div className="flex items-center rounded-lg border border-border overflow-hidden text-xs bg-muted/30">
          {([
            { id: 'trial' as AgendaTab, label: `Trial${!loading ? ` · ${trials.length}` : ''}` },
            { id: 'noshow' as AgendaTab, label: `Anti-noshow${!loading ? ` · ${calls.length}` : ''}` },
          ]).map(({ id, label }) => (
            <button key={id} onClick={() => setTab(id)}
              className={cn('px-3 py-1.5 font-medium transition-colors',
                tab === id ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted/50')}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      ) : tab === 'trial' ? (
        trials.length === 0
          ? <p className="text-sm text-muted-foreground text-center py-10">Nenhum trial ativo no momento</p>
          : <MetricasTrialCalendar trials={trials} />
      ) : (
        calls.length === 0
          ? <p className="text-sm text-muted-foreground text-center py-10">Nenhuma reunião agendada</p>
          : <AntiNoshowCalendar calls={calls} />
      )}
    </div>
  );
}
