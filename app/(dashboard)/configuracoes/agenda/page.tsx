'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import {
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Image,
  Mic,
  Video,
  CalendarDays,
  Users,
  Megaphone,
  Bot,
  FileText,
  X,
  Zap,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

// ─── Types ────────────────────────────────────────────────────────────────────

type SequenceTipo = 'follow_geral' | 'anti_noshow' | 'remarketing' | 'trial_saas';

interface AgendaEvent {
  id: string;
  leadName: string;
  leadCount: number;
  sequenceName: string;
  sequenceTipo: SequenceTipo;
  horario: string;
  tipoMensagem: string;
  dia: Date;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Retorna a segunda-feira da semana contendo `date` */
function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Dom, 1=Seg...
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function fmtWeekday(date: Date): string {
  return date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
}

function fmtDay(date: Date): string {
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function fmtMonthRange(start: Date, end: Date): string {
  const sm = start.toLocaleDateString('pt-BR', { month: 'long' });
  const em = end.toLocaleDateString('pt-BR', { month: 'long' });
  const sy = start.getFullYear();
  const ey = end.getFullYear();
  if (sy !== ey) return `${fmtDay(start)} ${sy} – ${fmtDay(end)} ${ey}`;
  if (sm !== em) return `${fmtDay(start)} – ${fmtDay(end)} de ${em} ${sy}`;
  return `${start.getDate()} – ${end.getDate()} de ${sm} ${sy}`;
}

// ─── Config por tipo ──────────────────────────────────────────────────────────

const TIPO_CONFIG: Record<SequenceTipo, {
  label: string;
  icon: React.ElementType;
  cardClass: string;
  badgeClass: string;
}> = {
  follow_geral: {
    label: 'Follow-up',
    icon: MessageSquare,
    cardClass: 'bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-300',
    badgeClass: 'bg-blue-500/20 text-blue-700 border-blue-500/30 dark:text-blue-300',
  },
  remarketing: {
    label: 'Remarketing',
    icon: Megaphone,
    cardClass: 'bg-orange-500/10 border-orange-500/20 text-orange-700 dark:text-orange-300',
    badgeClass: 'bg-orange-500/20 text-orange-700 border-orange-500/30 dark:text-orange-300',
  },
  trial_saas: {
    label: 'Trial SaaS',
    icon: FileText,
    cardClass: 'bg-purple-500/10 border-purple-500/20 text-purple-700 dark:text-purple-300',
    badgeClass: 'bg-purple-500/20 text-purple-700 border-purple-500/30 dark:text-purple-300',
  },
  anti_noshow: {
    label: 'Anti-Noshow',
    icon: Bot,
    cardClass: 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-300',
    badgeClass: 'bg-amber-500/20 text-amber-700 border-amber-500/30 dark:text-amber-300',
  },
};

const MSG_ICONS: Record<string, React.ElementType> = {
  texto: MessageSquare,
  imagem: Image,
  audio: Mic,
  video: Video,
};

// ─── API Event (raw from /api/follow/agenda) ──────────────────────────────────

interface ApiEvent {
  id: string;
  leadName: string;
  leadCount: number;
  sequenceName: string;
  sequenceTipo: string;
  horario: string;
  tipoMensagem: string;
  dia: string; // ISO
}

// ─── Event Card ───────────────────────────────────────────────────────────────

function EventCard({ event, onClick }: { event: AgendaEvent; onClick: () => void }) {
  const cfg = TIPO_CONFIG[event.sequenceTipo];
  const Icon = cfg.icon;
  const MsgIcon = MSG_ICONS[event.tipoMensagem] ?? MessageSquare;

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left rounded-xl border p-2.5 space-y-1.5 transition-all hover:opacity-80 hover:shadow-sm',
        cfg.cardClass,
      )}
    >
      <div className="flex items-center gap-1.5">
        <Icon className="w-3 h-3 shrink-0" />
        <span className="text-[10px] font-semibold uppercase tracking-wide truncate">{cfg.label}</span>
      </div>
      <p className="text-xs font-medium leading-tight truncate">{event.leadName}</p>
      <div className="flex items-center justify-between gap-1">
        <span className="text-[10px] font-mono opacity-80">{event.horario}</span>
        <MsgIcon className="w-3 h-3 opacity-60" />
      </div>
    </button>
  );
}

// ─── Event Detail Modal ───────────────────────────────────────────────────────

function EventDetail({ event, onClose }: { event: AgendaEvent; onClose: () => void }) {
  const cfg = TIPO_CONFIG[event.sequenceTipo];
  const Icon = cfg.icon;
  const MsgIcon = MSG_ICONS[event.tipoMensagem] ?? MessageSquare;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative bg-card border border-border rounded-2xl shadow-xl p-6 w-full max-w-sm space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center', cfg.cardClass)}>
              <Icon className="w-4 h-4" />
            </div>
            <div>
              <p className="font-semibold text-sm">{event.sequenceName}</p>
              <p className="text-xs text-muted-foreground">{cfg.label}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <Users className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="font-medium">{event.leadName}</span>
            {event.leadCount > 1 && (
              <Badge variant="secondary" className="text-xs">{event.leadCount} leads</Badge>
            )}
          </div>

          <div className="flex items-center gap-2 text-sm">
            <CalendarDays className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">
              {event.dia.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
            </span>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground w-4 text-center shrink-0">⏰</span>
            <span className="font-mono font-medium">{event.horario}</span>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <MsgIcon className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground capitalize">{event.tipoMensagem}</span>
          </div>
        </div>

        <div className={cn('px-3 py-2 rounded-xl border text-xs font-medium', cfg.badgeClass)}>
          Agendado para {event.horario} : {event.dia.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })}
        </div>
      </div>
    </div>
  );
}

// ─── Stats Row ────────────────────────────────────────────────────────────────

function StatsRow({ events }: { events: AgendaEvent[] }) {
  const total = events.reduce((acc, e) => acc + e.leadCount, 0);
  const byTipo = events.reduce<Record<string, number>>((acc, e) => {
    acc[e.sequenceTipo] = (acc[e.sequenceTipo] ?? 0) + e.leadCount;
    return acc;
  }, {});

  const stats = [
    { label: 'Total esta semana', value: total, icon: Users, color: 'text-foreground' },
    { label: 'Follow-up', value: byTipo['follow_geral'] ?? 0, icon: MessageSquare, color: 'text-blue-600 dark:text-blue-400' },
    { label: 'Remarketing', value: byTipo['remarketing'] ?? 0, icon: Megaphone, color: 'text-orange-600 dark:text-orange-400' },
    { label: 'Trial SaaS', value: byTipo['trial_saas'] ?? 0, icon: FileText, color: 'text-purple-600 dark:text-purple-400' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {stats.map((s) => {
        const Icon = s.icon;
        return (
          <div key={s.label} className="bg-card rounded-xl border border-border p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <Icon className={cn('w-4 h-4', s.color)} />
            </div>
            <div className="min-w-0">
              <p className={cn('text-lg font-bold tabular-nums', s.color)}>{s.value}</p>
              <p className="text-[10px] text-muted-foreground truncate">{s.label}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Trial Types ──────────────────────────────────────────────────────────────

interface TrialCompany {
  id: number
  name: string
  email: string
  created_at: string
  trial_ends_at: string | null
  plan_type: string
  is_active: boolean
}

function trialDaysLeft(endsAt: string | null): number | null {
  if (!endsAt) return null
  return Math.ceil((new Date(endsAt).getTime() - Date.now()) / 86400000)
}

// ─── Trial Detail Modal ───────────────────────────────────────────────────────

function TrialDetail({ trial, onClose }: { trial: TrialCompany; onClose: () => void }) {
  const days = trialDaysLeft(trial.trial_ends_at)
  const expired = days !== null && days <= 0
  const urgent = days !== null && days <= 2 && days > 0

  const statusColor = expired
    ? 'bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-300'
    : urgent
    ? 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-300'
    : 'bg-primary/10 border-primary/20 text-primary'

  const badgeColor = expired
    ? 'bg-red-500/20 text-red-700 border-red-500/30 dark:text-red-300'
    : urgent
    ? 'bg-amber-500/20 text-amber-700 border-amber-500/30 dark:text-amber-300'
    : 'bg-primary/20 text-primary border-primary/30'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative bg-card border border-border rounded-2xl shadow-xl p-6 w-full max-w-sm space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center', statusColor)}>
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <p className="font-semibold text-sm">{trial.name}</p>
              <p className="text-xs text-muted-foreground">Trial SaaS</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <Users className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="font-medium truncate">{trial.email}</span>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <CalendarDays className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">
              Início: {new Date(trial.created_at).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
            </span>
          </div>

          {trial.trial_ends_at && (
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">
                Expira: {new Date(trial.trial_ends_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}
              </span>
            </div>
          )}

          <div className="flex items-center gap-2 text-sm">
            <AlertTriangle className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className={cn('font-medium', expired ? 'text-red-500' : urgent ? 'text-amber-500' : 'text-primary')}>
              {expired ? 'Trial expirado' : days !== null ? `${days} dias restantes` : '7 dias restantes'}
            </span>
          </div>
        </div>

        <div className={cn('px-3 py-2 rounded-xl border text-xs font-medium', badgeColor)}>
          {expired
            ? `Expirado em ${trial.trial_ends_at ? new Date(trial.trial_ends_at).toLocaleDateString('pt-BR') : ':'}`
            : `Trial ativo : ${days ?? 7}d restantes`}
        </div>
      </div>
    </div>
  )
}

// ─── Trial Calendar View ──────────────────────────────────────────────────────

function TrialCalendar({ monday, sunday, today, weekOffset, setWeekOffset }: {
  monday: Date; sunday: Date; today: Date;
  weekOffset: number; setWeekOffset: (fn: (o: number) => number) => void;
}) {
  const [trials, setTrials] = useState<TrialCompany[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTrial, setSelectedTrial] = useState<TrialCompany | null>(null)

  useEffect(() => {
    fetch('/api/admin/trials')
      .then(r => r.json())
      .then(d => setTrials(d.trials ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i))

  function trialsForDay(day: Date): TrialCompany[] {
    return trials.filter(t => {
      const start = new Date(t.created_at)
      return isSameDay(start, day)
    })
  }

  const active = trials.filter(t => (trialDaysLeft(t.trial_ends_at) ?? 0) > 0)
  const expired = trials.filter(t => (trialDaysLeft(t.trial_ends_at) ?? 0) <= 0)

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card rounded-xl border border-border p-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Zap className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-lg font-bold tabular-nums text-primary">{trials.length}</p>
            <p className="text-[10px] text-muted-foreground">Total em trial</p>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <p className="text-lg font-bold tabular-nums text-green-600 dark:text-green-400">{active.length}</p>
            <p className="text-[10px] text-muted-foreground">Ativos</p>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4 h-4 text-red-500" />
          </div>
          <div>
            <p className="text-lg font-bold tabular-nums text-red-500">{expired.length}</p>
            <p className="text-[10px] text-muted-foreground">Expirados</p>
          </div>
        </div>
      </div>

      {/* Calendar */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="grid grid-cols-7 border-b border-border">
          {days.map((day, i) => {
            const isToday = isSameDay(day, today)
            const count = trialsForDay(day).length
            return (
              <div key={i} className={cn('p-3 text-center border-r border-border last:border-r-0', isToday && 'bg-primary/5')}>
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'][i]}</p>
                <p className={cn('text-lg font-bold mt-0.5 tabular-nums', isToday ? 'text-primary' : 'text-foreground')}>{day.getDate()}</p>
                {count > 0 && (
                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold mt-0.5">{count}</span>
                )}
              </div>
            )
          })}
        </div>
        <div className="grid grid-cols-7 min-h-[320px]">
          {days.map((day, i) => {
            const dayTrials = trialsForDay(day)
            const isToday = isSameDay(day, today)
            return (
              <div key={i} className={cn('p-2 space-y-1.5 border-r border-border last:border-r-0 min-h-[120px]', isToday && 'bg-primary/5')}>
                {loading ? (
                  <div className="h-12 rounded-lg bg-muted animate-pulse" />
                ) : dayTrials.length === 0 ? (
                  <div className="flex items-center justify-center h-20 text-[10px] text-muted-foreground/40">:</div>
                ) : dayTrials.map(t => {
                  const d = trialDaysLeft(t.trial_ends_at)
                  const isExpired = d !== null && d <= 0
                  const isUrgent = d !== null && d <= 2 && d > 0
                  return (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTrial(t)}
                      className={cn(
                        'w-full text-left rounded-xl border p-2.5 space-y-1 transition-all hover:opacity-80 hover:shadow-sm',
                        isExpired ? 'bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-300'
                          : isUrgent ? 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-300'
                          : 'bg-primary/10 border-primary/20 text-primary'
                      )}
                    >
                      <div className="flex items-center gap-1">
                        <Zap className="w-3 h-3 shrink-0" />
                        <span className="text-[10px] font-semibold uppercase tracking-wide truncate">Trial</span>
                      </div>
                      <p className="text-xs font-medium leading-tight truncate">{t.name}</p>
                      <p className="text-[10px] font-mono opacity-80">
                        {isExpired ? 'Expirado' : d !== null ? `${d}d restantes` : '7d'}
                      </p>
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>

      {/* List */}
      {trials.length > 0 && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-sm font-semibold">Todos os trials</p>
          </div>
          <div className="divide-y divide-border">
            {trials.map(t => {
              const d = trialDaysLeft(t.trial_ends_at)
              const isExpired = d !== null && d <= 0
              return (
                <button
                  key={t.id}
                  onClick={() => setSelectedTrial(t)}
                  className="w-full flex items-center justify-between px-4 py-3 gap-3 hover:bg-muted/30 transition-colors text-left"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{t.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{t.email}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-muted-foreground">
                      Início: {new Date(t.created_at).toLocaleDateString('pt-BR')}
                    </p>
                    <span className={cn(
                      'text-[11px] font-semibold',
                      isExpired ? 'text-red-500' : (d ?? 0) <= 2 ? 'text-amber-500' : 'text-primary'
                    )}>
                      {isExpired ? 'Expirado' : `${d}d restantes`}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Trial detail modal */}
      {selectedTrial && (
        <TrialDetail trial={selectedTrial} onClose={() => setSelectedTrial(null)} />
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const WEEKDAY_SHORT = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

export default function AgendaPage() {
  const [view, setView] = useState<'sequences' | 'trial'>('sequences');
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedEvent, setSelectedEvent] = useState<AgendaEvent | null>(null);
  const [allEvents, setAllEvents] = useState<AgendaEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);

  useEffect(() => {
    fetch('/api/follow/agenda')
      .then((r) => r.json())
      .then((json) => {
        const raw: ApiEvent[] = json.events ?? [];
        setAllEvents(raw.map((e) => ({
          ...e,
          sequenceTipo: e.sequenceTipo as SequenceTipo,
          dia: new Date(e.dia),
        })));
      })
      .catch(() => setAllEvents([]))
      .finally(() => setLoadingEvents(false));
  }, []);

  const today = new Date();
  const baseMonday = getMonday(today);
  const monday = addDays(baseMonday, weekOffset * 7);
  const sunday = addDays(monday, 6);

  // Filter to current week
  const events = allEvents.filter((e) => {
    const d = e.dia;
    return d >= monday && d <= addDays(sunday, 1);
  });

  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));

  function eventsForDay(day: Date): AgendaEvent[] {
    return events.filter((e) => isSameDay(e.dia, day));
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 py-2 pb-16">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Agenda de Automações</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {fmtMonthRange(monday, sunday)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Tabs */}
          <div className="flex items-center rounded-xl border border-border overflow-hidden bg-card">
            <button
              onClick={() => setView('sequences')}
              className={cn('px-3 py-1.5 text-xs font-medium transition-colors', view === 'sequences' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
            >
              Sequências
            </button>
            <button
              onClick={() => setView('trial')}
              className={cn('px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1', view === 'trial' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
            >
              <Zap className="w-3 h-3" /> Trial SaaS
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setWeekOffset(0)}
            className={cn('h-8 px-3 text-xs', weekOffset === 0 && 'bg-primary text-primary-foreground border-primary')}
          >
            Hoje
          </Button>
          <div className="flex items-center rounded-xl border border-border overflow-hidden bg-card">
            <button
              onClick={() => setWeekOffset((o) => o - 1)}
              className="px-2 py-1.5 hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setWeekOffset((o) => o + 1)}
              className="px-2 py-1.5 hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Trial SaaS view */}
      {view === 'trial' && (
        <TrialCalendar
          monday={monday}
          sunday={sunday}
          today={today}
          weekOffset={weekOffset}
          setWeekOffset={setWeekOffset}
        />
      )}

      {/* Sequences view */}
      {view === 'sequences' && (
        <>
          {/* Stats */}
          {loadingEvents ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[0,1,2,3].map((i) => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}
            </div>
          ) : (
            <StatsRow events={events} />
          )}

          {/* Grid */}
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-border">
              {days.map((day, i) => {
                const isToday = isSameDay(day, today);
                const count = eventsForDay(day).length;
                return (
                  <div
                    key={i}
                    className={cn(
                      'p-3 text-center border-r border-border last:border-r-0',
                      isToday && 'bg-primary/5',
                    )}
                  >
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                      {WEEKDAY_SHORT[i]}
                    </p>
                    <p className={cn(
                      'text-lg font-bold mt-0.5 tabular-nums',
                      isToday ? 'text-primary' : 'text-foreground',
                    )}>
                      {day.getDate()}
                    </p>
                    {count > 0 && (
                      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold mt-0.5">
                        {count}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Day columns */}
            <div className="grid grid-cols-7 min-h-[320px]">
              {days.map((day, i) => {
                const dayEvents = eventsForDay(day);
                const isToday = isSameDay(day, today);
                return (
                  <div
                    key={i}
                    className={cn(
                      'p-2 space-y-1.5 border-r border-border last:border-r-0 min-h-[120px]',
                      isToday && 'bg-primary/5',
                    )}
                  >
                    {dayEvents.length === 0 ? (
                      <div className="flex items-center justify-center h-20 text-[10px] text-muted-foreground/40 text-center">
                        :
                      </div>
                    ) : (
                      dayEvents
                        .sort((a, b) => a.horario.localeCompare(b.horario))
                        .map((event) => (
                          <EventCard
                            key={event.id}
                            event={event}
                            onClick={() => setSelectedEvent(event)}
                          />
                        ))
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Event detail */}
          {selectedEvent && (
            <EventDetail event={selectedEvent} onClose={() => setSelectedEvent(null)} />
          )}
        </>
      )}
    </div>
  );
}
