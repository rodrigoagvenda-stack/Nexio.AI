'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Clock, Info, Loader2, Video } from 'lucide-react';
import { AutomationsNav } from '@/components/automacoes/AutomationsNav';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

type Kind = 'follow' | 'noshow' | 'remarketing';
type Filter = 'all' | 'calls' | Kind;

interface Call { id: number; at: string; lead: string; status: string; meetUrl: string | null }
interface Disparo { id: string; at: string; kind: Kind; sequence: string; lead: string; preview: string }
interface CalData { calls: Call[]; disparos: Disparo[]; lastDisparoAt: string | null; pastPendingAt: string[] }

const KIND_META: Record<Kind, { label: string; dot: string; chip: string; chipText: string }> = {
  follow: { label: 'Follow-up', dot: 'bg-[#60A5FA]', chip: 'bg-[#60A5FA]/[0.16]', chipText: 'text-[#1D4ED8] dark:text-[#DCEBFF]' },
  noshow: { label: 'Anti no-show', dot: 'bg-[#F5B544]', chip: 'bg-[#F5B544]/[0.16]', chipText: 'text-[#8A5A00] dark:text-[#F7E2B8]' },
  remarketing: { label: 'Remarketing', dot: 'bg-[#FB923C]', chip: 'bg-[#FB923C]/[0.16]', chipText: 'text-[#9A3E00] dark:text-[#FDDCBF]' },
};
const FILTERS: { id: Filter; label: string; dot?: string }[] = [
  { id: 'all', label: 'Tudo' },
  { id: 'calls', label: 'Calls', dot: 'bg-[#96F63C]' },
  { id: 'follow', label: 'Follow-up', dot: 'bg-[#60A5FA]' },
  { id: 'noshow', label: 'Anti no-show', dot: 'bg-[#F5B544]' },
  { id: 'remarketing', label: 'Remarketing', dot: 'bg-[#FB923C]' },
];
const STATUS: Record<string, { label: string; cls: string }> = {
  agendada: { label: 'Agendada', cls: 'bg-[#F5B544]/[0.14] text-[#8A5A00] dark:bg-[#F5B544]/[0.14] dark:text-[#F5B544]' },
  confirmada: { label: 'Confirmada', cls: 'bg-[#60A5FA]/[0.14] text-[#1D4ED8] dark:text-[#93C5FD]' },
  realizada: { label: 'Realizada', cls: 'bg-[#01573C]/[0.12] text-[#01573C] dark:bg-[#96F63C]/[0.14] dark:text-[#96F63C]' },
  no_show: { label: 'No-show', cls: 'bg-red-500/[0.14] text-red-700 dark:text-red-400' },
  cancelada: { label: 'Cancelada', cls: 'bg-muted text-muted-foreground' },
};
const WEEKDAY = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const WEEKDAY_LONG = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

const CARD = 'rounded-[14px] border border-border bg-card';
const PILL3D = 'flex h-10 items-center justify-center rounded-full bg-[#141414] text-white shadow-[inset_0_1px_0_#FFFFFF1F,0_3px_0_#000000] transition-transform active:translate-y-px';

const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const mondayOf = (d: Date) => { const x = startOfDay(d); x.setDate(x.getDate() + (x.getDay() === 0 ? -6 : 1 - x.getDay())); return x; };
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const dd = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function rangeTitle(a: Date, b: Date) {
  if (a.getMonth() === b.getMonth()) return `${a.getDate()} a ${b.getDate()} de ${MONTHS[a.getMonth()]}`;
  return `${a.getDate()} de ${MONTHS[a.getMonth()]} a ${b.getDate()} de ${MONTHS[b.getMonth()]}`;
}

export default function CalendarioPage() {
  const { toast } = useToast();
  const [weekOffset, setWeekOffset] = useState(0);
  const [filter, setFilter] = useState<Filter>('all');
  const [data, setData] = useState<CalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<Date>(() => startOfDay(new Date()));
  const [showAll, setShowAll] = useState(false);

  const today = useMemo(() => startOfDay(new Date()), []);
  const monday = useMemo(() => addDays(mondayOf(today), weekOffset * 7), [today, weekOffset]);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(monday, i)), [monday]);
  const sunday = days[6];

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const res = await fetch(`/api/automacoes/calendario?from=${monday.toISOString()}&to=${addDays(monday, 7).toISOString()}`);
      if (!res.ok) throw new Error();
      setData(await res.json());
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [monday]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setSelected(weekOffset === 0 ? today : monday); setShowAll(false); }, [weekOffset, monday, today]);
  useEffect(() => { setShowAll(false); }, [selected, filter]);

  const showCalls = filter === 'all' || filter === 'calls';
  const kindOn = (k: Kind) => filter === 'all' || filter === k;
  const callsOf = (day: Date) => (data?.calls ?? []).filter((c) => sameDay(new Date(c.at), day));
  const disparosOf = (day: Date) => (data?.disparos ?? []).filter((d) => sameDay(new Date(d.at), day) && kindOn(d.kind));

  const selCalls = showCalls ? callsOf(selected) : [];
  const selDisparos = disparosOf(selected);
  const listed = showAll ? selDisparos : selDisparos.slice(0, 4);
  const hasPastPending = selCalls.some((c) => c.status === 'agendada' && new Date(c.at) < new Date());

  // Aviso de silêncio: só na semana atual, quando o último disparo é de antes de hoje e nada mais está marcado
  const banner = useMemo(() => {
    if (!data || weekOffset !== 0) return null;
    const last = data.lastDisparoAt ? new Date(data.lastDisparoAt) : null;
    const now = new Date();
    const futureCall = data.calls.some((c) => new Date(c.at) > now && c.status !== 'cancelada');
    if (!last || last >= today || futureCall) return null;
    const lastDay = startOfDay(last);
    const from = addDays(lastDay, 1);
    const range = lastDay >= monday && from <= sunday && !sameDay(lastDay, sunday) ? `de ${WEEKDAY_LONG[from.getDay()]} a domingo` : 'nesta semana';
    const pending = data.pastPendingAt.map((p) => new Date(p));
    let tail = '';
    if (pending.length > 0) {
      const days = new Set(pending.map((p) => startOfDay(p).getTime()));
      tail = days.size === 1
        ? ` ${pending.length === 1 ? 'A call de' : `As ${pending.length} calls de`} ${WEEKDAY_LONG[pending[0].getDay()]} ainda ${pending.length === 1 ? 'está' : 'estão'} como Agendada.`
        : ` ${pending.length} calls passadas ainda estão como Agendada.`;
    }
    return {
      title: `Nada aconteceu depois de ${WEEKDAY_LONG[last.getDay()]}, ${dd(last)}, às ${hhmm(data.lastDisparoAt as string)}`,
      text: `Não saiu nenhum disparo e não há calls marcadas ${range}.${tail}`,
    };
  }, [data, weekOffset, today, monday, sunday]);

  const setCallStatus = async (call: Call, status: string) => {
    const before = data;
    setData((d) => d && { ...d, calls: d.calls.map((c) => (c.id === call.id ? { ...c, status } : c)), pastPendingAt: status === 'agendada' ? d.pastPendingAt : d.pastPendingAt.filter((p) => p !== call.at) });
    try {
      const res = await fetch('/api/automacoes/calendario', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ leadId: call.id, call_status: status }) });
      if (!res.ok) throw new Error();
      toast({ title: `Call marcada como ${STATUS[status]?.label ?? status}`, variant: 'success' });
    } catch {
      setData(before);
      toast({ title: 'Não foi possível atualizar a call', description: 'Tente de novo em instantes.', variant: 'destructive' });
    }
  };

  const selIsToday = sameDay(selected, today);
  const selTitle = `${cap(WEEKDAY_LONG[selected.getDay()])}, ${selected.getDate()} de ${MONTHS[selected.getMonth()]}`;
  const summary = [showCalls ? plural(selCalls.length, 'call', 'calls') : null, filter === 'calls' ? null : plural(selDisparos.length, 'disparo', 'disparos')].filter(Boolean).join(' e ');

  return (
    <div className="mx-auto flex w-full max-w-[1900px] flex-col gap-[22px] pb-12 pt-2">
      <AutomationsNav active="calendario" />

      <div className="flex flex-wrap items-center justify-between gap-6">
        <div className="flex items-center gap-[18px]">
          <h2 className="text-[22px] font-semibold leading-7 tracking-[-0.01em] text-foreground">{rangeTitle(monday, sunday)}</h2>
          <div className="flex items-center gap-2">
            <button type="button" aria-label="Semana anterior" onClick={() => setWeekOffset((o) => o - 1)} className={cn(PILL3D, 'w-10')}><ChevronLeft className="h-4 w-4" strokeWidth={2.4} /></button>
            <button type="button" aria-label="Próxima semana" onClick={() => setWeekOffset((o) => o + 1)} className={cn(PILL3D, 'w-10')}><ChevronRight className="h-4 w-4" strokeWidth={2.4} /></button>
            <button type="button" onClick={() => setWeekOffset(0)} className={cn(PILL3D, 'px-5 text-sm font-semibold')}>Hoje</button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={cn('flex items-center gap-2 rounded-full px-4 py-2 text-[13.5px] transition-colors', filter === f.id ? 'bg-[#0F3D2B] font-semibold text-white' : 'bg-muted text-muted-foreground hover:text-foreground')}
            >
              {f.dot && <span className={cn('h-2 w-2 shrink-0 rounded-full', f.dot)} />}
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {banner && (
        <div className="flex items-center gap-4 rounded-[14px] border border-[#F5B544]/35 bg-[#F5B544]/[0.08] px-6 py-[18px]">
          <Clock className="h-[22px] w-[22px] shrink-0 text-[#F5B544]" strokeWidth={2} />
          <div className="flex flex-col gap-[3px]">
            <p className="text-base font-semibold leading-5 text-foreground">{banner.title}</p>
            <p className="text-sm leading-[18px] text-[#8A6A1F] dark:text-[#C9B27A]">{banner.text}</p>
          </div>
        </div>
      )}

      {failed ? (
        <p className="py-16 text-center text-muted-foreground">Não foi possível carregar o calendário agora. Tente de novo em instantes.</p>
      ) : (
        <div className="flex flex-col gap-6 xl:flex-row xl:items-stretch">
          <div className={cn(CARD, 'flex min-w-0 flex-1 flex-col overflow-hidden')}>
            <div className="flex min-h-[520px] flex-1 overflow-x-auto">
              {days.map((day, i) => {
                const isSel = sameDay(day, selected);
                const isToday = sameDay(day, today);
                const past = day <= today;
                const calls = showCalls ? callsOf(day) : [];
                const disp = disparosOf(day);
                const kinds = (['follow', 'noshow', 'remarketing'] as Kind[]).map((k) => ({ k, n: disp.filter((d) => d.kind === k).length })).filter((x) => x.n > 0);
                const muted = isSel ? 'text-[#A9C9B7]' : 'text-[#7A7A7A]';
                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    aria-pressed={isSel}
                    onClick={() => setSelected(day)}
                    className={cn('flex min-w-[132px] flex-1 flex-col gap-3.5 px-3 py-[22px] text-left transition-colors', i > 0 && 'border-l border-border', isSel ? 'gap-3 bg-[#E4F1E9] dark:bg-[#12301F]' : 'hover:bg-muted/50')}
                  >
                    <span className="flex flex-col gap-0.5">
                      <span className="flex items-center gap-2">
                        <span className={cn('text-[12.5px] font-semibold leading-4 tracking-[0.05em]', isToday ? 'text-[#01573C] dark:text-[#96F63C]' : isSel ? 'text-[#3E6B54] dark:text-[#A9C9B7]' : 'text-muted-foreground')}>{WEEKDAY[day.getDay()]}</span>
                        {isToday && <span className="rounded-full bg-[#01573C]/10 px-2 py-0.5 text-[11px] font-semibold leading-[14px] tracking-[0.02em] text-[#01573C] dark:bg-[#96F63C]/[0.14] dark:text-[#96F63C]">Hoje</span>}
                      </span>
                      <span className={cn('text-[30px] font-semibold leading-9 tracking-[-0.02em]', isToday ? 'text-[#01573C] dark:text-[#96F63C]' : isSel ? 'text-[#0B2A1A] dark:text-white' : 'text-foreground')}>{day.getDate()}</span>
                    </span>

                    {showCalls && (calls.length === 0 ? (
                      <span className="text-[13.5px] leading-[18px] text-muted-foreground/80">Sem calls</span>
                    ) : (
                      <span className="flex flex-col gap-1.5">
                        <span className={cn('text-xs font-semibold uppercase leading-4 tracking-[0.04em]', muted)}>{plural(calls.length, 'call', 'calls')}</span>
                        {calls.map((c) => (
                          <span key={c.id} className="flex items-center gap-2 rounded-[10px] bg-[#96F63C]/[0.18] p-2.5 dark:bg-[#96F63C]/[0.18]">
                            <Video className="h-3.5 w-3.5 shrink-0 text-[#01573C] dark:text-[#96F63C]" strokeWidth={2.2} />
                            <span className="truncate text-[13px] font-semibold leading-4 text-foreground">{hhmm(c.at)} {c.lead}</span>
                          </span>
                        ))}
                      </span>
                    ))}

                    {past && filter !== 'calls' && (kinds.length === 0 ? (
                      <span className="text-[13.5px] leading-[18px] text-muted-foreground/80">Nenhum disparo</span>
                    ) : (
                      <span className="flex flex-col gap-1.5">
                        <span className={cn('text-xs font-semibold uppercase leading-4 tracking-[0.04em]', muted)}>{plural(disp.length, 'disparo', 'disparos')}</span>
                        {kinds.map(({ k, n }) => (
                          <span key={k} className={cn('flex items-center justify-between rounded-[10px] p-2.5', KIND_META[k].chip)}>
                            <span className="flex items-center gap-1.5"><span className={cn('h-2 w-2 shrink-0 rounded-full', KIND_META[k].dot)} /><span className={cn('whitespace-nowrap text-[12.5px] leading-4', KIND_META[k].chipText)}>{KIND_META[k].label}</span></span>
                            <span className="text-sm font-semibold leading-[18px] text-foreground">{n}</span>
                          </span>
                        ))}
                      </span>
                    ))}
                  </button>
                );
              })}
            </div>
            <p className="flex items-center gap-2.5 border-t border-border px-[22px] py-4 text-[13.5px] leading-[18px] text-muted-foreground"><Info className="h-4 w-4 shrink-0" />Mostra as calls marcadas e os disparos já enviados. Os disparos dos próximos dias ainda não aparecem aqui.</p>
          </div>

          <aside className={cn(CARD, 'flex w-full shrink-0 flex-col gap-5 p-[26px] xl:w-[520px]')}>
            <div className="flex flex-col gap-[5px]">
              <h3 className="text-[19px] font-semibold leading-6 text-foreground">{selTitle}</h3>
              <p className="text-sm leading-[18px] text-muted-foreground">{loading && !data ? 'Carregando…' : `${summary}.`}</p>
            </div>

            {loading && !data ? (
              <div className="flex h-40 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : (
              <>
                {showCalls && (
                  <div className="flex flex-col gap-2.5">
                    <p className="text-[15px] font-semibold leading-[18px] text-foreground">Calls</p>
                    {selCalls.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhuma call neste dia.</p>
                    ) : (
                      <>
                        <div className="flex flex-col rounded-xl border border-border bg-muted/60 dark:bg-[#181818]">
                          {selCalls.map((c, i) => {
                            const st = STATUS[c.status] ?? STATUS.agendada;
                            return (
                              <div key={c.id} className={cn('flex items-center justify-between gap-3 px-4 py-3.5', i > 0 && 'border-t border-border')}>
                                <div className="flex min-w-0 items-center gap-3">
                                  <span className="text-sm font-semibold leading-[18px] text-foreground/90">{hhmm(c.at)}</span>
                                  <div className="flex min-w-0 flex-col gap-0.5">
                                    <span className="truncate text-[14.5px] font-semibold leading-[18px] text-foreground">{c.lead}</span>
                                    <span className="text-[13px] leading-4 text-muted-foreground">{c.meetUrl ? 'Google Meet' : 'Sem link de reunião'}</span>
                                  </div>
                                </div>
                                <Select value={STATUS[c.status] ? c.status : 'agendada'} onValueChange={(v) => void setCallStatus(c, v)}>
                                  <SelectTrigger aria-label={`Situação da call de ${c.lead}`} className={cn('h-auto w-auto shrink-0 gap-2 rounded-full border-0 py-[7px] pl-3.5 pr-3 text-[13px] font-semibold leading-4 shadow-none focus:ring-0 focus:ring-offset-0 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:opacity-100', st.cls)}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent align="end">
                                    {Object.entries(STATUS).map(([id, s]) => <SelectItem key={id} value={id}>{s.label}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              </div>
                            );
                          })}
                        </div>
                        {hasPastPending && <p className="text-[13px] leading-[150%] text-muted-foreground">O horário já passou. Marque se a call aconteceu, para o funil e o dashboard contarem certo.</p>}
                      </>
                    )}
                  </div>
                )}

                {filter !== 'calls' && (
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center justify-between pb-1.5">
                      <p className="text-[15px] font-semibold leading-[18px] text-foreground">Disparos</p>
                      {selDisparos.length > 1 && <p className="text-[13px] leading-4 text-muted-foreground">Do mais recente ao mais antigo</p>}
                    </div>
                    {selDisparos.length === 0 ? (
                      <p className="border-t border-border py-3 text-sm text-muted-foreground">{selected > today ? 'Os disparos dos próximos dias ainda não aparecem aqui.' : 'Nenhum disparo neste dia.'}</p>
                    ) : listed.map((d) => (
                      <div key={d.id} className="flex gap-3.5 border-t border-border py-3">
                        <span className="w-11 shrink-0 text-[13.5px] font-semibold leading-[18px] text-foreground/90">{hhmm(d.at)}</span>
                        <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', KIND_META[d.kind].dot)} />
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <span className="truncate text-[14.5px] font-semibold leading-[18px] text-foreground">{d.lead}</span>
                          <span className="truncate text-[13.5px] leading-[18px] text-muted-foreground">{d.preview || d.sequence}</span>
                        </div>
                      </div>
                    ))}
                    {selDisparos.length > 4 && (
                      <div className="flex items-center justify-between pt-3">
                        <span className="text-[13.5px] text-muted-foreground">{showAll ? `${selDisparos.length} disparos` : `4 de ${selDisparos.length} disparos`}</span>
                        <button type="button" onClick={() => setShowAll((v) => !v)} className="rounded-full bg-muted px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-accent">{showAll ? 'Ver menos' : 'Ver todos'}</button>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
            {selIsToday && !loading && selCalls.length === 0 && selDisparos.length === 0 && <p className="text-sm text-muted-foreground">Nada aconteceu hoje até agora.</p>}
          </aside>
        </div>
      )}
    </div>
  );
}
