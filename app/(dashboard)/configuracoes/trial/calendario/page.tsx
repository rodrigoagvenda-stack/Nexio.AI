'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils/cn';
import {
  ChevronLeft, ChevronRight, CalendarDays, Clock,
  MessageCircle, Phone, UserCheck, X, ArrowLeft,
  TrendingUp, FlaskConical, Bell,
} from 'lucide-react';
import Link from 'next/link';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CalEvent {
  id: string;
  trialId: string;
  leadName: string;
  leadWhatsapp: string;
  trialStatus: 'ativo' | 'convertido' | 'expirado';
  trialDays: number;
  createdAt: string;
  stepId: string;
  stepOffset: number;
  stepType: string;
  stepCondition: string;
  stepOrder: number;
  date: string;
  dateStr: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS_PT = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

const STATUS_COLOR: Record<string, string> = {
  ativo:      'bg-primary/10 border-primary/30 text-primary',
  convertido: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600',
  expirado:   'bg-muted border-border text-muted-foreground',
};

const STEP_TYPE_COLOR: Record<string, string> = {
  text:     'bg-blue-500',
  image:    'bg-violet-500',
  video:    'bg-rose-500',
  audio:    'bg-amber-500',
  ptt:      'bg-amber-500',
  document: 'bg-sky-500',
  default:  'bg-primary',
};

function stepColor(type: string) {
  return STEP_TYPE_COLOR[type] ?? STEP_TYPE_COLOR.default;
}

// ─── Mini calendar ────────────────────────────────────────────────────────────

function MiniCalendar({
  current, onSelect, activeDates,
}: { current: Date; onSelect: (d: Date) => void; activeDates: Set<string> }) {
  const [mini, setMini] = useState(new Date(current.getFullYear(), current.getMonth(), 1));
  const today = new Date();

  const days: Array<Date | null> = [];
  const firstDay = new Date(mini.getFullYear(), mini.getMonth(), 1).getDay();
  for (let i = 0; i < firstDay; i++) days.push(null);
  const daysInMonth = new Date(mini.getFullYear(), mini.getMonth() + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) days.push(new Date(mini.getFullYear(), mini.getMonth(), d));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <button onClick={() => setMini(new Date(mini.getFullYear(), mini.getMonth() - 1, 1))} className="p-1 rounded-lg hover:bg-accent/50">
          <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
        <p className="text-xs font-semibold text-foreground">{MONTHS_PT[mini.getMonth()]} {mini.getFullYear()}</p>
        <button onClick={() => setMini(new Date(mini.getFullYear(), mini.getMonth() + 1, 1))} className="p-1 rounded-lg hover:bg-accent/50">
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {DAYS_PT.map(d => (
          <p key={d} className="text-[9px] font-semibold text-muted-foreground/60 text-center py-0.5">{d[0]}</p>
        ))}
        {days.map((day, i) => {
          if (!day) return <div key={i} />;
          const ds = toDateStr(day);
          const isToday = isSameDay(day, today);
          const isSelected = isSameDay(day, current);
          const hasEvents = activeDates.has(ds);
          return (
            <button
              key={i}
              onClick={() => onSelect(day)}
              className={cn(
                'h-6 w-6 mx-auto rounded-full text-[10px] font-medium flex items-center justify-center transition-colors relative',
                isSelected ? 'bg-primary text-primary-foreground' : isToday ? 'border border-primary text-primary' : 'text-foreground hover:bg-accent/60'
              )}
            >
              {day.getDate()}
              {hasEvents && !isSelected && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Event pill ───────────────────────────────────────────────────────────────

function EventPill({ event, onClick }: { event: CalEvent; onClick: () => void }) {
  const time = new Date(event.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left px-2 py-1 rounded-lg border text-[10px] truncate transition-colors hover:opacity-80',
        STATUS_COLOR[event.trialStatus]
      )}
    >
      <span className={cn('inline-block w-1.5 h-1.5 rounded-full mr-1 align-middle', stepColor(event.stepType))} />
      <span className="font-medium">{time}</span>
      {' '}
      <span className="truncate">{event.leadName}</span>
    </button>
  );
}

// ─── Event detail popup ───────────────────────────────────────────────────────

function EventDetail({ event, onClose }: { event: CalEvent; onClose: () => void }) {
  const dt = new Date(event.date);
  const time = dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const dateLabel = dt.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

  async function handleAction(action: 'converter' | 'estender' | 'encerrar') {
    const status = action === 'converter' ? 'convertido' : action === 'encerrar' ? 'expirado' : null;
    if (status) {
      await fetch(`/api/trial/list`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trialId: event.trialId, status }),
      });
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-2xl shadow-2xl p-5 w-80 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-bold text-foreground">{event.leadName}</p>
            <p className="text-xs text-muted-foreground capitalize">{dateLabel} · {time}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-accent/50">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* meta */}
        <div className="space-y-1.5 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Phone className="h-3.5 w-3.5" />
            <span>{event.leadWhatsapp || '—'}</span>
          </div>
          <div className="flex items-center gap-2">
            <FlaskConical className="h-3.5 w-3.5" />
            <span>Dia {event.stepOffset} de {event.trialDays} do trial</span>
          </div>
          <div className="flex items-center gap-2">
            <MessageCircle className="h-3.5 w-3.5" />
            <span className="capitalize">{event.stepType} · {event.stepCondition}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium', STATUS_COLOR[event.trialStatus])}>
              {event.trialStatus === 'ativo' ? 'Em trial' : event.trialStatus === 'convertido' ? 'Convertido' : 'Expirado'}
            </span>
          </div>
        </div>

        {/* actions */}
        {event.trialStatus === 'ativo' && (
          <div className="grid grid-cols-3 gap-2 pt-1 border-t border-border">
            <button
              onClick={() => handleAction('converter')}
              className="flex flex-col items-center gap-1 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 hover:bg-emerald-500/20 transition-colors text-[10px] font-semibold"
            >
              <UserCheck className="h-4 w-4" />
              Converter
            </button>
            <button
              onClick={() => handleAction('estender')}
              className="flex flex-col items-center gap-1 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-700 hover:bg-blue-500/20 transition-colors text-[10px] font-semibold"
            >
              <TrendingUp className="h-4 w-4" />
              Estender
            </button>
            <button
              onClick={() => handleAction('encerrar')}
              className="flex flex-col items-center gap-1 py-2 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive hover:bg-destructive/20 transition-colors text-[10px] font-semibold"
            >
              <X className="h-4 w-4" />
              Encerrar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TrialCalendarioPage() {
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay());
    return d;
  });
  const [selectedEvent, setSelectedEvent] = useState<CalEvent | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/trial/calendario');
      const data = await res.json();
      setEvents(data.events ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Build week days
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  const activeDates = new Set(events.map(e => e.dateStr));
  const today = new Date();

  // Events for selected date
  const todayEvents = events
    .filter(e => e.dateStr === toDateStr(selectedDate))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Events per week day
  function eventsForDay(d: Date) {
    return events.filter(e => e.dateStr === toDateStr(d)).sort((a, b) => a.date.localeCompare(b.date));
  }

  // Stats for sidebar
  const activeCount = events.filter(e => e.trialStatus === 'ativo').length;
  const todayCount = events.filter(e => e.dateStr === toDateStr(today)).length;

  function prevWeek() {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    setWeekStart(d);
  }
  function nextWeek() {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    setWeekStart(d);
  }

  return (
    <div className="max-w-full space-y-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/configuracoes/trial"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              Calendário de Trial
            </h1>
            <p className="text-xs text-muted-foreground">{activeCount} eventos no período</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={prevWeek} className="p-1.5 rounded-lg border border-border hover:bg-accent/50">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button onClick={() => { setSelectedDate(new Date()); setWeekStart((() => { const d = new Date(); d.setDate(d.getDate() - d.getDay()); return d; })()); }} className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-accent/50 font-medium">
            Hoje
          </button>
          <button onClick={nextWeek} className="p-1.5 rounded-lg border border-border hover:bg-accent/50">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex gap-4 min-h-0">
        {/* Left sidebar */}
        <div className="w-52 flex-shrink-0 space-y-4">
          {/* Mini calendar */}
          <div className="rounded-2xl border border-border bg-card p-3">
            <MiniCalendar
              current={selectedDate}
              onSelect={(d) => {
                setSelectedDate(d);
                const ws = new Date(d);
                ws.setDate(d.getDate() - d.getDay());
                setWeekStart(ws);
              }}
              activeDates={activeDates}
            />
          </div>

          {/* Stats */}
          <div className="rounded-2xl border border-border bg-card p-3 space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Resumo</p>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground flex items-center gap-1.5"><Bell className="h-3 w-3" />Hoje</span>
                <span className="text-xs font-bold text-foreground">{todayCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground flex items-center gap-1.5"><FlaskConical className="h-3 w-3" />Ativos</span>
                <span className="text-xs font-bold text-primary">{Array.from(new Set(events.filter(e => e.trialStatus === 'ativo').map(e => e.trialId))).length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground flex items-center gap-1.5"><UserCheck className="h-3 w-3" />Convertidos</span>
                <span className="text-xs font-bold text-emerald-600">{Array.from(new Set(events.filter(e => e.trialStatus === 'convertido').map(e => e.trialId))).length}</span>
              </div>
            </div>
          </div>

          {/* Today's events list */}
          <div className="rounded-2xl border border-border bg-card p-3 space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
              {toDateStr(selectedDate) === toDateStr(today) ? 'Hoje' : selectedDate.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}
            </p>
            {loading ? (
              <p className="text-xs text-muted-foreground">Carregando…</p>
            ) : todayEvents.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum evento</p>
            ) : (
              <div className="space-y-1">
                {todayEvents.slice(0, 8).map((e) => (
                  <EventPill key={e.id} event={e} onClick={() => setSelectedEvent(e)} />
                ))}
                {todayEvents.length > 8 && (
                  <p className="text-[10px] text-muted-foreground text-center">+{todayEvents.length - 8} mais</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Week grid */}
        <div className="flex-1 min-w-0 rounded-2xl border border-border bg-card overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-border">
            {weekDays.map((day) => {
              const isToday = isSameDay(day, today);
              const isSelected = isSameDay(day, selectedDate);
              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setSelectedDate(new Date(day))}
                  className={cn(
                    'flex flex-col items-center py-2.5 border-r last:border-r-0 border-border transition-colors',
                    isSelected ? 'bg-primary/5' : 'hover:bg-accent/30'
                  )}
                >
                  <p className="text-[10px] text-muted-foreground">{DAYS_PT[day.getDay()]}</p>
                  <div className={cn(
                    'w-7 h-7 rounded-full flex items-center justify-center text-sm font-semibold mt-0.5',
                    isToday ? 'bg-primary text-primary-foreground' : isSelected ? 'bg-accent text-foreground' : 'text-foreground'
                  )}>
                    {day.getDate()}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Events grid */}
          <div className="grid grid-cols-7 h-[calc(100%-70px)] divide-x divide-border overflow-y-auto">
            {weekDays.map((day) => {
              const dayEvs = eventsForDay(day);
              const isToday = isSameDay(day, today);
              return (
                <div
                  key={day.toISOString()}
                  className={cn('p-1.5 space-y-1 overflow-y-auto', isToday && 'bg-primary/3')}
                >
                  {loading ? (
                    <div className="h-4 w-full rounded bg-muted animate-pulse" />
                  ) : dayEvs.length === 0 ? (
                    <p className="text-[9px] text-muted-foreground/30 text-center pt-2">—</p>
                  ) : (
                    dayEvs.slice(0, 6).map((e) => (
                      <EventPill key={e.id} event={e} onClick={() => setSelectedEvent(e)} />
                    ))
                  )}
                  {dayEvs.length > 6 && (
                    <p className="text-[9px] text-muted-foreground/60 text-center">+{dayEvs.length - 6}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Event popup */}
      {selectedEvent && (
        <EventDetail event={selectedEvent} onClose={() => { setSelectedEvent(null); load(); }} />
      )}
    </div>
  );
}
