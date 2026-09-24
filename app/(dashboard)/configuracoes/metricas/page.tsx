'use client';

import { useState, useEffect, useCallback } from 'react';
import { startOfDay, startOfWeek, startOfMonth, startOfYear, endOfDay } from 'date-fns';
import { Info, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AutomationsNav } from '@/components/automacoes/AutomationsNav';
import { FilterPeriod } from '@/components/dashboard/FilterButtons';
import { DateRangePicker } from '@/components/dashboard/DateRangePicker';

interface DateRange { from: Date | undefined; to: Date | undefined }

interface MetricasData {
  periodo: string;
  overview: {
    total_enviados: number;
    total_falhas: number;
    total_responderam: number;
    taxa_resposta: number;
    anterior_enviados?: number;
    delta_enviados: number;
  };
  por_dia: Array<{ data: string; enviados: number; falhas: number; responderam: number }>;
  ranking_sequencias: Array<{ id: string; nome: string; tipo: string; label: string; enviados: number; falhas: number; responderam: number; taxa_resposta: number }>;
  ultimas_execucoes: Array<{ id: string; enviado_em: string }>;
}

const CARD = 'rounded-[14px] border border-border bg-card';
const LIME = 'text-[#01573C] dark:text-[#96F63C]';
const PERIOD_LABELS: Record<FilterPeriod, string> = { today: 'Hoje', week: 'Semana', month: 'Mês', year: 'Ano', custom: 'Personalizado' };
const PERIODS: FilterPeriod[] = ['today', 'week', 'month', 'year', 'custom'];
const TIPO_DOT: Record<string, string> = { follow_geral: 'bg-blue-500', follow_proposta: 'bg-blue-500', anti_noshow: 'bg-amber-500', remarketing: 'bg-orange-500', trial_saas: 'bg-emerald-500' };

const fmt = (n: number) => n.toLocaleString('pt-BR');
const shortDate = (d: Date) => d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });

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
  const [range, setRange] = useState(() => getPeriodRange('month'));
  const [data, setData] = useState<MetricasData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (period: FilterPeriod, dr?: DateRange) => {
    setLoading(true);
    setError(null);
    try {
      const r = getPeriodRange(period, dr);
      setRange(r);
      const res = await fetch(`/api/metricas?from=${r.from.toISOString()}&to=${r.to.toISOString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Não foi possível carregar as métricas');
      setData(json);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load('month'); }, [load]);

  const pick = (period: FilterPeriod) => {
    setSelectedPeriod(period);
    if (period !== 'custom') { setDateRange(undefined); setShowDatePicker(false); void load(period); }
    else setShowDatePicker(true);
  };

  const o = data?.overview;
  const last = data?.ultimas_execucoes?.[0]?.enviado_em ? new Date(data.ultimas_execucoes[0].enviado_em) : null;
  const daysSince = last ? Math.floor((Date.now() - last.getTime()) / 86_400_000) : null;
  const perDay = data?.por_dia ?? [];
  const maxDay = Math.max(1, ...perDay.map((d) => d.enviados + d.falhas));
  const emptyDays = perDay.filter((d) => d.enviados + d.falhas === 0);
  // Trecho final sem nenhum disparo (o que costuma indicar automação parada)
  let tail = 0;
  for (let i = perDay.length - 1; i >= 0 && perDay[i].enviados + perDay[i].falhas === 0; i--) tail++;
  const tailFrom = tail > 0 ? perDay[perDay.length - tail].data.slice(0, 2) : null;
  const tailTo = tail > 0 ? perDay[perDay.length - 1].data.slice(0, 2) : null;
  const ranking = [...(data?.ranking_sequencias ?? [])].sort((a, b) => b.enviados - a.enviados);
  const prev = o?.anterior_enviados ?? 0;

  return (
    <div className="mx-auto flex w-full max-w-[1900px] flex-col gap-6 pb-14 pt-2">
      <AutomationsNav active="metricas" />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h2 className="text-2xl font-semibold leading-8 tracking-tight text-foreground">Os disparos estão gerando resposta?</h2>
          <p className="text-[15px] text-muted-foreground">Follow-up, anti no-show e remarketing. De {shortDate(range.from)} a {shortDate(range.to)}.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={selectedPeriod === p}
              onClick={() => pick(p)}
              className={cn('rounded-full border px-4 py-2 text-sm transition-colors', selectedPeriod === p ? 'border-transparent bg-[#0F3D2B] font-semibold text-white' : 'border-border bg-card text-muted-foreground hover:text-foreground')}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
          {showDatePicker && <DateRangePicker date={dateRange} onDateChange={(dr) => { setDateRange(dr); if (dr?.from && dr?.to) void load('custom', dr); }} />}
        </div>
      </div>

      {error && <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm text-red-700 dark:text-red-300">{error}</p>}

      {loading && !data ? (
        <div className="flex h-56 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : data && o ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className={cn(CARD, 'flex flex-col gap-2 px-6 py-5')}>
              <p className="text-[15px] text-foreground/85">Disparos enviados</p>
              <p className="text-[34px] font-semibold leading-[42px] tracking-tight text-foreground">{fmt(o.total_enviados)}</p>
              <p className="text-sm text-muted-foreground">{o.total_falhas > 0 ? `${fmt(o.total_falhas)} ${o.total_falhas === 1 ? 'falha' : 'falhas'} de envio` : 'Sem falhas de envio'}</p>
            </div>
            <div className={cn(CARD, 'flex flex-col gap-2 px-6 py-5')}>
              <p className="text-[15px] text-foreground/85">Responderam em até 3 dias</p>
              <p className="flex items-baseline gap-2.5"><span className={cn('text-[34px] font-semibold leading-[42px] tracking-tight', LIME)}>{fmt(o.total_responderam)}</span><span className={cn('text-lg font-semibold', LIME)}>{o.taxa_resposta}%</span></p>
              <p className="text-sm text-muted-foreground">dos disparos tiveram resposta</p>
            </div>
            <div className={cn(CARD, 'flex flex-col gap-2 px-6 py-5')}>
              <p className="text-[15px] text-foreground/85">Período anterior</p>
              {prev > 0 ? (
                <>
                  <p className={cn('text-[34px] font-semibold leading-[42px] tracking-tight', o.delta_enviados >= 0 ? 'text-foreground' : 'text-red-600 dark:text-red-400')}>{o.delta_enviados > 0 ? '+' : ''}{o.delta_enviados}%</p>
                  <p className="text-sm text-muted-foreground">{fmt(prev)} disparos no período anterior</p>
                </>
              ) : (
                <>
                  <p className="text-[34px] font-semibold leading-[42px] tracking-tight text-muted-foreground">Sem dados</p>
                  <p className="text-sm text-muted-foreground">Não houve disparos no período anterior para comparar</p>
                </>
              )}
            </div>
            <div className={cn(CARD, 'flex flex-col gap-2 px-6 py-5', daysSince != null && daysSince >= 2 && 'border-amber-500/40 bg-amber-500/[0.06]')}>
              <p className="text-[15px] text-foreground/85">Último disparo</p>
              {last ? (
                <>
                  <p className={cn('text-[34px] font-semibold leading-[42px] tracking-tight', daysSince != null && daysSince >= 2 ? 'text-amber-600 dark:text-[#F5B544]' : 'text-foreground')}>{last.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</p>
                  <p className="text-sm text-muted-foreground">às {last.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}{daysSince != null && daysSince > 0 ? `, há ${daysSince} ${daysSince === 1 ? 'dia' : 'dias'}` : ', hoje'}</p>
                </>
              ) : (
                <>
                  <p className="text-[34px] font-semibold leading-[42px] tracking-tight text-muted-foreground">Nenhum</p>
                  <p className="text-sm text-muted-foreground">Nenhum disparo no período</p>
                </>
              )}
            </div>
          </div>

          <section className={cn(CARD, 'flex flex-col gap-5 px-8 py-7')}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-col gap-1"><h3 className="text-xl font-semibold text-foreground">Disparos por dia</h3><p className="text-sm text-muted-foreground">A parte verde é quem respondeu em até 3 dias.</p></div>
              <div className="flex items-center gap-5 text-sm text-muted-foreground">
                <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-muted-foreground/40" /> Disparos</span>
                <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-[#01573C] dark:bg-[#96F63C]" /> Responderam</span>
              </div>
            </div>
            {perDay.length === 0 ? (
              <p className="py-12 text-center text-[15px] text-muted-foreground">Sem disparos no período.</p>
            ) : (
              <>
                <div className="flex h-56 items-end gap-1.5 sm:gap-2" role="img" aria-label="Disparos por dia">
                  {perDay.map((d) => {
                    const total = d.enviados + d.falhas;
                    const h = total > 0 ? Math.max((total / maxDay) * 100, 3) : 0;
                    const g = total > 0 ? (d.responderam / total) * 100 : 0;
                    return (
                      <div key={d.data} className="group relative flex h-full min-w-0 flex-1 flex-col items-center justify-end" title={`${d.data}: ${fmt(d.enviados)} enviados, ${fmt(d.responderam)} responderam`}>
                        <div className="flex w-full max-w-[26px] flex-col justify-end overflow-hidden rounded-t-md rounded-b-[3px] bg-muted-foreground/35" style={{ height: `${h}%`, minHeight: total > 0 ? 4 : 2, backgroundColor: total === 0 ? 'hsl(var(--border))' : undefined }}>
                          {g > 0 && <div className="w-full bg-[#01573C] dark:bg-[#96F63C]" style={{ height: `${g}%`, minHeight: 3 }} />}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-1.5 sm:gap-2">
                  {perDay.map((d) => {
                    const empty = d.enviados + d.falhas === 0;
                    return <span key={d.data} className={cn('min-w-0 flex-1 text-center text-xs tabular-nums', empty && tail > 0 && d.data.slice(0, 2) >= (tailFrom ?? '99') ? 'font-semibold text-amber-600 dark:text-[#F5B544]' : 'text-muted-foreground')}>{d.data.slice(0, 2).replace(/^0/, '')}</span>;
                  })}
                </div>
                {tail > 0 && tail < perDay.length && (
                  <p className="text-sm text-amber-700 dark:text-[#F5B544]">{tail === 1 ? `Dia ${Number(tailFrom)}: nenhum disparo.` : `Dias ${Number(tailFrom)} a ${Number(tailTo)}: nenhum disparo.`}</p>
                )}
                {tail === 0 && emptyDays.length > 0 && <p className="text-sm text-muted-foreground">{emptyDays.length} {emptyDays.length === 1 ? 'dia' : 'dias'} sem disparo neste período.</p>}
              </>
            )}
          </section>

          <section className={cn(CARD, 'flex flex-col gap-4 px-8 py-7')}>
            <div className="flex flex-col gap-1"><h3 className="text-xl font-semibold text-foreground">Cada sequência</h3><p className="text-sm text-muted-foreground">Quem mais gerou resposta em até 3 dias.</p></div>
            {ranking.length === 0 ? (
              <p className="py-10 text-center text-[15px] text-muted-foreground">Nenhuma sequência disparou neste período.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] border-collapse">
                  <thead><tr className="text-left text-[13px] tracking-[0.06em] text-muted-foreground"><th className="py-3 font-medium">SEQUÊNCIA</th><th className="py-3 text-right font-medium">ENVIOS</th><th className="py-3 pl-8 text-right font-medium">RESPONDERAM</th></tr></thead>
                  <tbody>
                    {ranking.map((s) => (
                      <tr key={s.id} className="border-t border-border">
                        <td className="py-4"><span className="flex items-center gap-3"><span className={cn('h-2 w-2 shrink-0 rounded-full', TIPO_DOT[s.tipo] ?? 'bg-muted-foreground')} /><span className="flex flex-col"><span className="text-[15px] font-semibold text-foreground">{s.nome}</span><span className="text-xs text-muted-foreground">{s.label}</span></span></span></td>
                        <td className="py-4 text-right text-[15px] tabular-nums text-foreground">{fmt(s.enviados)}</td>
                        <td className="py-4 pl-8 text-right text-[15px] tabular-nums text-foreground">{fmt(s.responderam)} · {s.taxa_resposta}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="flex items-center gap-3 rounded-xl border border-border bg-muted px-5 py-3.5 text-sm text-muted-foreground"><Info className="h-4 w-4 shrink-0" /> Conta quando o lead manda mensagem em até 3 dias depois do disparo. Uma resposta pode ser para a conversa em andamento, não só para o disparo.</p>
          </section>
        </>
      ) : null}
    </div>
  );
}
