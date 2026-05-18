'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils/cn';
import {
  ChevronLeft, ChevronRight, CalendarDays, Clock,
  MessageCircle, Phone, UserCheck, X, ArrowLeft,
  TrendingUp, FlaskConical, Bell, User,
} from 'lucide-react';
import Link from 'next/link';

// ─── Types ─────────────────────────────────────────────────────────────────────

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
  stepOrder: number;
  date: string;      // ISO string
  dateStr: string;   // 'yyyy-MM-dd'
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const DAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const HOUR_START = 8;
const HOUR_END = 20;
const HOUR_HEIGHT = 64; // px per hour

// ─── Helpers ───────────────────────────────────────────────────────────────────

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function getWeekStart(d: Date): Date {
  const s = new Date(d);
  s.setDate(d.getDate() - d.getDay());
  s.setHours(0, 0, 0, 0);
  return s;
}

function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map(n => n[0]?.toUpperCase() ?? '')
    .join('');
}

// ─── Color maps ────────────────────────────────────────────────────────────────

const STATUS_BORDER: Record<string, string> = {
  ativo:      'border-l-blue-500',
  convertido: 'border-l-emerald-500',
  expirado:   'border-l-slate-400',
};

const STATUS_BG: Record<string, string> = {
  ativo:      'bg-blue-50 dark:bg-blue-950/40',
  convertido: 'bg-emerald-50 dark:bg-emerald-950/40',
  expirado:   'bg-slate-50 dark:bg-slate-900/40',
};

const STATUS_TEXT: Record<string, string> = {
  ativo:      'text-blue-700 dark:text-blue-300',
  convertido: 'text-emerald-700 dark:text-emerald-300',
  expirado:   'text-slate-500 dark:text-slate-400',
};

const STATUS_BADGE_BG: Record<string, string> = {
  ativo:      'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
  convertido: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
  expirado:   'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

const STATUS_LABEL: Record<string, string> = {
  ativo: 'Em trial', convertido: 'Convertido', expirado: 'Expirado',
};

const STEP_TYPE_DOT: Record<string, string> = {
  text:     'bg-blue-500',
  image:    'bg-violet-500',
  video:    'bg-rose-500',
  audio:    'bg-amber-500',
  ptt:      'bg-amber-500',
  document: 'bg-sky-500',
};

function stepDotColor(type: string): string {
  return STEP_TYPE_DOT[type] ?? 'bg-slate-400';
}

// ─── Mini Calendar ─────────────────────────────────────────────────────────────

function MiniCalendar({
  selected,
  onSelect,
  activeDates,
}: {
  selected: Date;
  onSelect: (d: Date) => void;
  activeDates: Set<string>;
}) {
  const [miniMonth, setMiniMonth] = useState(
    new Date(selected.getFullYear(), selected.getMonth(), 1),
  );
  const today = new Date();

  const firstDow = new Date(miniMonth.getFullYear(), miniMonth.getMonth(), 1).getDay();
  const daysInMonth = new Date(miniMonth.getFullYear(), miniMonth.getMonth() + 1, 0).getDate();

  const cells: Array<Date | null> = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(miniMonth.getFullYear(), miniMonth.getMonth(), d));
  // Pad to complete rows
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="space-y-2 select-none">
      {/* Month nav */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setMiniMonth(new Date(miniMonth.getFullYear(), miniMonth.getMonth() - 1, 1))}
          className="p-1 rounded-lg hover:bg-accent/50 transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
        <p className="text-[11px] font-semibold text-foreground">
          {MONTHS_PT[miniMonth.getMonth()]} {miniMonth.getFullYear()}
        </p>
        <button
          onClick={() => setMiniMonth(new Date(miniMonth.getFullYear(), miniMonth.getMonth() + 1, 1))}
          className="p-1 rounded-lg hover:bg-accent/50 transition-colors"
        >
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7">
        {DAYS_PT.map(d => (
          <p key={d} className="text-[9px] font-semibold text-muted-foreground/50 text-center py-0.5">
            {d[0]}
          </p>
        ))}
        {cells.map((day, i) => {
          if (!day) return <div key={`blank-${i}`} className="h-6" />;
          const ds = toDateStr(day);
          const isToday = isSameDay(day, today);
          const isSelected = isSameDay(day, selected);
          const hasEvents = activeDates.has(ds);
          return (
            <button
              key={ds}
              onClick={() => onSelect(day)}
              className={cn(
                'h-6 w-6 mx-auto rounded-full flex items-center justify-center text-[10px] font-medium relative transition-colors',
                isSelected
                  ? 'bg-primary text-primary-foreground'
                  : isToday
                  ? 'border border-primary text-primary'
                  : 'text-foreground hover:bg-accent/60',
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

// ─── Avatar with photo fetch ────────────────────────────────────────────────────

function LeadAvatar({
  name,
  phone,
  size = 48,
}: {
  name: string;
  phone: string;
  size?: number;
}) {
  const [photo, setPhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!phone) { setLoading(false); return; }
    let cancelled = false;
    fetch(`/api/chat/contact-photo?phone=${encodeURIComponent(phone)}`)
      .then(r => r.json())
      .then(d => { if (!cancelled) { setPhoto(d.photo ?? null); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [phone]);

  const px = `${size}px`;

  if (!loading && photo) {
    return (
      <img
        src={photo}
        alt={name}
        style={{ width: px, height: px }}
        className="rounded-full object-cover ring-2 ring-border"
      />
    );
  }

  return (
    <div
      style={{ width: px, height: px }}
      className={cn(
        'rounded-full flex items-center justify-center text-sm font-bold ring-2 ring-border',
        'bg-gradient-to-br from-blue-400 to-indigo-500 text-white',
        loading && 'animate-pulse',
      )}
    >
      {loading ? '' : initials(name)}
    </div>
  );
}

// ─── Event card (grid) ─────────────────────────────────────────────────────────

function GridEventCard({
  event,
  onClick,
  columnIndex,
  totalColumns,
}: {
  event: CalEvent;
  onClick: () => void;
  columnIndex: number;
  totalColumns: number;
}) {
  const dt = new Date(event.date);
  const hours = dt.getHours();
  const minutes = dt.getMinutes();

  // Position within visible range
  const offsetMinutes = (hours - HOUR_START) * 60 + minutes;
  const top = (offsetMinutes / 60) * HOUR_HEIGHT;
  const height = Math.max(HOUR_HEIGHT - 4, 20); // snap to 1 hour height

  const widthPct = 100 / totalColumns;
  const leftPct = columnIndex * widthPct;

  const timeLabel = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

  return (
    <button
      onClick={onClick}
      style={{
        top: `${top}px`,
        height: `${height}px`,
        left: `${leftPct + 1}%`,
        width: `${widthPct - 2}%`,
      }}
      className={cn(
        'absolute overflow-hidden rounded-md border-l-[3px] px-1.5 py-1 text-left transition-all',
        'hover:brightness-95 hover:shadow-md cursor-pointer',
        STATUS_BG[event.trialStatus],
        STATUS_BORDER[event.trialStatus],
      )}
    >
      <div className="flex items-center gap-1 min-w-0">
        <span className={cn('flex-shrink-0 w-1.5 h-1.5 rounded-full', stepDotColor(event.stepType))} />
        <span className={cn('text-[10px] font-semibold truncate leading-tight', STATUS_TEXT[event.trialStatus])}>
          {event.leadName}
        </span>
      </div>
      <p className="text-[9px] text-muted-foreground/70 mt-0.5 leading-none">
        {timeLabel} · Dia {event.stepOffset}
      </p>
    </button>
  );
}

// ─── Event Modal ───────────────────────────────────────────────────────────────

function EventModal({
  event,
  onClose,
  onRefresh,
}: {
  event: CalEvent;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const dt = new Date(event.date);
  const timeLabel = dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const dateLabel = dt.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  const progressPct = Math.min(100, Math.round((event.stepOffset / event.trialDays) * 100));

  const [acting, setActing] = useState<string | null>(null);

  async function handleAction(action: 'converter' | 'encerrar') {
    setActing(action);
    try {
      const status = action === 'converter' ? 'convertido' : 'expirado';
      await fetch('/api/trial/list', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trialId: event.trialId, status }),
      });
      onRefresh();
      onClose();
    } finally {
      setActing(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-2xl shadow-2xl w-96 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Close */}
        <div className="flex items-center justify-end p-3 pb-0">
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-accent/60 transition-colors"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Profile */}
        <div className="flex flex-col items-center gap-2 px-6 pb-4">
          <LeadAvatar name={event.leadName} phone={event.leadWhatsapp} size={56} />
          <div className="text-center space-y-1">
            <p className="text-base font-bold text-foreground">{event.leadName}</p>
            {event.leadWhatsapp && (
              <p className="text-xs text-muted-foreground flex items-center justify-center gap-1.5">
                <Phone className="h-3 w-3" />
                {event.leadWhatsapp}
              </p>
            )}
          </div>
          <span className={cn('px-2.5 py-0.5 rounded-full text-[11px] font-semibold', STATUS_BADGE_BG[event.trialStatus])}>
            {STATUS_LABEL[event.trialStatus]}
          </span>
        </div>

        {/* Divider */}
        <div className="border-t border-border mx-6" />

        {/* Body */}
        <div className="px-6 py-4 space-y-4">
          {/* Progress */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-foreground flex items-center gap-1.5">
                <FlaskConical className="h-3.5 w-3.5 text-muted-foreground" />
                Trial
              </p>
              <p className="text-xs text-muted-foreground font-semibold">
                Dia {event.stepOffset} de {event.trialDays}
              </p>
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  event.trialStatus === 'convertido' ? 'bg-emerald-500' :
                  event.trialStatus === 'expirado'   ? 'bg-slate-400' : 'bg-blue-500',
                )}
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          {/* Step info */}
          <div className="rounded-xl bg-muted/50 border border-border px-3 py-2.5 space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
              Step atual
            </p>
            <div className="flex items-center gap-2 text-xs text-foreground">
              <span className={cn('w-2 h-2 rounded-full flex-shrink-0', stepDotColor(event.stepType))} />
              <Clock className="h-3 w-3 text-muted-foreground" />
              <span className="font-medium">{dateLabel}</span>
              <span className="text-muted-foreground">·</span>
              <span>{timeLabel}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <MessageCircle className="h-3 w-3" />
              <span className="capitalize">{event.stepType}</span>
              <span>·</span>
              <span>Ordem {event.stepOrder}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        {event.trialStatus === 'ativo' && (
          <div className="px-6 pb-5 grid grid-cols-3 gap-2">
            <button
              onClick={() => handleAction('converter')}
              disabled={!!acting}
              className={cn(
                'flex flex-col items-center gap-1 py-2.5 rounded-xl text-[11px] font-semibold transition-all',
                'bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100',
                'dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/60',
                acting === 'converter' && 'opacity-60 pointer-events-none',
              )}
            >
              <UserCheck className="h-4 w-4" />
              Converter
            </button>
            <button
              disabled={!!acting}
              className={cn(
                'flex flex-col items-center gap-1 py-2.5 rounded-xl text-[11px] font-semibold transition-all',
                'bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100',
                'dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-blue-950/60',
                acting && 'opacity-60 pointer-events-none',
              )}
            >
              <TrendingUp className="h-4 w-4" />
              Estender
            </button>
            <button
              onClick={() => handleAction('encerrar')}
              disabled={!!acting}
              className={cn(
                'flex flex-col items-center gap-1 py-2.5 rounded-xl text-[11px] font-semibold transition-all',
                'bg-red-50 border border-red-200 text-red-600 hover:bg-red-100',
                'dark:bg-red-950/40 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/60',
                acting === 'encerrar' && 'opacity-60 pointer-events-none',
              )}
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

// ─── Sidebar event pill ─────────────────────────────────────────────────────────

function SidebarPill({ event, onClick }: { event: CalEvent; onClick: () => void }) {
  const time = new Date(event.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-lg border-l-[3px] transition-colors hover:opacity-80',
        STATUS_BG[event.trialStatus],
        STATUS_BORDER[event.trialStatus],
      )}
    >
      <span className={cn('flex-shrink-0 w-1.5 h-1.5 rounded-full', stepDotColor(event.stepType))} />
      <div className="min-w-0">
        <p className={cn('text-[11px] font-semibold truncate', STATUS_TEXT[event.trialStatus])}>
          {event.leadName}
        </p>
        <p className="text-[9px] text-muted-foreground">{time}</p>
      </div>
    </button>
  );
}

// ─── Time grid ──────────────────────────────────────────────────────────────────

function WeekTimeGrid({
  weekDays,
  events,
  selectedDate,
  onSelectEvent,
}: {
  weekDays: Date[];
  events: CalEvent[];
  selectedDate: Date;
  onSelectEvent: (e: CalEvent) => void;
}) {
  const hours = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);
  const today = new Date();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll to 08:00 on mount
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, []);

  // Group events by day, and within each day handle overlaps
  function getDayEventLayout(day: Date): Array<{ event: CalEvent; col: number; totalCols: number }> {
    const dayStr = toDateStr(day);
    const dayEvents = events
      .filter(e => e.dateStr === dayStr)
      .filter(e => {
        const h = new Date(e.date).getHours();
        return h >= HOUR_START && h < HOUR_END;
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    if (dayEvents.length === 0) return [];

    // Simple greedy column assignment
    const cols: CalEvent[][] = [];
    const layout: Array<{ event: CalEvent; col: number; totalCols: number }> = [];

    for (const ev of dayEvents) {
      const evTime = new Date(ev.date).getTime();
      const evEnd = evTime + 55 * 60 * 1000; // treat each event as 55min
      let placed = false;
      for (let c = 0; c < cols.length; c++) {
        const lastInCol = cols[c][cols[c].length - 1];
        const lastEnd = new Date(lastInCol.date).getTime() + 55 * 60 * 1000;
        if (evTime >= lastEnd) {
          cols[c].push(ev);
          layout.push({ event: ev, col: c, totalCols: 0 });
          placed = true;
          break;
        }
      }
      if (!placed) {
        cols.push([ev]);
        layout.push({ event: ev, col: cols.length - 1, totalCols: 0 });
      }
    }

    // Set totalCols
    const maxCol = cols.length;
    for (const item of layout) item.totalCols = maxCol;

    return layout;
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden rounded-2xl border border-border bg-card">
      {/* Day headers */}
      <div className="grid border-b border-border flex-shrink-0" style={{ gridTemplateColumns: '52px repeat(7, 1fr)' }}>
        {/* Time gutter header */}
        <div className="border-r border-border" />
        {weekDays.map(day => {
          const isToday = isSameDay(day, today);
          const isSel = isSameDay(day, selectedDate);
          return (
            <div
              key={day.toISOString()}
              className={cn(
                'flex flex-col items-center py-3 border-r last:border-r-0 border-border',
                isToday ? 'bg-primary/5' : '',
              )}
            >
              <p className="text-[9px] font-semibold text-muted-foreground/60 uppercase">
                {DAYS_PT[day.getDay()]}
              </p>
              <div className={cn(
                'w-7 h-7 mt-1 rounded-full flex items-center justify-center text-sm font-bold',
                isToday ? 'bg-primary text-primary-foreground' : 'text-foreground',
              )}>
                {day.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Scrollable time+events area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-minimal">
        <div className="flex" style={{ minHeight: `${(HOUR_END - HOUR_START) * HOUR_HEIGHT}px` }}>
          {/* Hour labels */}
          <div className="w-[52px] flex-shrink-0 border-r border-border">
            {hours.map(h => (
              <div
                key={h}
                style={{ height: `${HOUR_HEIGHT}px` }}
                className="border-b border-border/50 flex items-start justify-end pr-2 pt-1"
              >
                <span className="text-[9px] text-muted-foreground/50 font-medium leading-none">
                  {String(h).padStart(2, '0')}:00
                </span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekDays.map(day => {
            const layout = getDayEventLayout(day);
            const isToday = isSameDay(day, today);
            const dayTotalHeight = (HOUR_END - HOUR_START) * HOUR_HEIGHT;

            return (
              <div
                key={day.toISOString()}
                className={cn(
                  'flex-1 border-r last:border-r-0 border-border relative',
                  isToday ? 'bg-primary/[0.025]' : '',
                )}
                style={{ minHeight: `${dayTotalHeight}px` }}
              >
                {/* Hour lines */}
                {hours.map(h => (
                  <div
                    key={h}
                    style={{ top: `${(h - HOUR_START) * HOUR_HEIGHT}px`, height: `${HOUR_HEIGHT}px` }}
                    className="absolute inset-x-0 border-b border-border/30"
                  />
                ))}

                {/* Events */}
                {layout.map(({ event, col, totalCols }) => (
                  <GridEventCard
                    key={event.id}
                    event={event}
                    onClick={() => onSelectEvent(event)}
                    columnIndex={col}
                    totalColumns={totalCols}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function TrialCalendarioPage() {
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [selectedEvent, setSelectedEvent] = useState<CalEvent | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/trial/calendario');
      const data = await res.json();
      setEvents(data.events ?? []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  const activeDates = new Set(events.map(e => e.dateStr));
  const today = new Date();

  const todayDateStr = toDateStr(today);
  const selectedDateStr = toDateStr(selectedDate);

  const todayEvents = events
    .filter(e => e.dateStr === selectedDateStr)
    .sort((a, b) => a.date.localeCompare(b.date));

  const uniqueActiveTrials = new Set(events.filter(e => e.trialStatus === 'ativo').map(e => e.trialId)).size;
  const uniqueConvertedTrials = new Set(events.filter(e => e.trialStatus === 'convertido').map(e => e.trialId)).size;
  const todayCount = events.filter(e => e.dateStr === todayDateStr).length;

  function goToDay(d: Date) {
    setSelectedDate(d);
    setWeekStart(getWeekStart(d));
  }

  function goToday() {
    goToDay(new Date());
  }

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

  const weekLabel = (() => {
    const last = weekDays[6];
    const first = weekDays[0];
    if (first.getMonth() === last.getMonth()) {
      return `${first.getDate()}–${last.getDate()} ${MONTHS_PT[first.getMonth()]} ${first.getFullYear()}`;
    }
    return `${first.getDate()} ${MONTHS_PT[first.getMonth()]} – ${last.getDate()} ${MONTHS_PT[last.getMonth()]} ${last.getFullYear()}`;
  })();

  return (
    <div className="flex flex-col gap-4 h-full" style={{ height: 'calc(100vh - 120px)' }}>
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <Link
            href="/configuracoes/trial"
            className="p-1.5 rounded-lg border border-border hover:bg-accent/50 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 text-muted-foreground" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              Calendário de Trial
            </h1>
            <p className="text-xs text-muted-foreground">{weekLabel}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={prevWeek}
            className="p-1.5 rounded-lg border border-border hover:bg-accent/50 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={goToday}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-border hover:bg-accent/50 transition-colors"
          >
            Hoje
          </button>
          <button
            onClick={nextWeek}
            className="p-1.5 rounded-lg border border-border hover:bg-accent/50 transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex gap-4 flex-1 min-h-0">
        {/* Left sidebar */}
        <div className="w-56 flex-shrink-0 flex flex-col gap-3 overflow-y-auto scrollbar-minimal">
          {/* Mini calendar */}
          <div className="rounded-2xl border border-border bg-card p-3">
            <MiniCalendar
              selected={selectedDate}
              onSelect={goToDay}
              activeDates={activeDates}
            />
          </div>

          {/* Stats */}
          <div className="rounded-2xl border border-border bg-card p-3 space-y-2">
            <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50">
              Resumo
            </p>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Bell className="h-3 w-3" />
                  Hoje
                </span>
                <span className="text-xs font-bold text-foreground">{todayCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <FlaskConical className="h-3 w-3 text-blue-500" />
                  Ativos
                </span>
                <span className="text-xs font-bold text-blue-600 dark:text-blue-400">{uniqueActiveTrials}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <UserCheck className="h-3 w-3 text-emerald-500" />
                  Convertidos
                </span>
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{uniqueConvertedTrials}</span>
              </div>
            </div>
          </div>

          {/* Selected day events */}
          <div className="rounded-2xl border border-border bg-card p-3 space-y-2 flex-1">
            <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50">
              {selectedDateStr === todayDateStr
                ? 'Hoje'
                : selectedDate.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}
            </p>
            {loading ? (
              <div className="space-y-1.5">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-8 rounded-lg bg-muted animate-pulse" />
                ))}
              </div>
            ) : todayEvents.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2 text-center">Nenhum evento</p>
            ) : (
              <div className="space-y-1">
                {todayEvents.slice(0, 10).map(e => (
                  <SidebarPill key={e.id} event={e} onClick={() => setSelectedEvent(e)} />
                ))}
                {todayEvents.length > 10 && (
                  <p className="text-[9px] text-muted-foreground text-center pt-1">
                    +{todayEvents.length - 10} mais
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Week time grid */}
        {loading ? (
          <div className="flex-1 rounded-2xl border border-border bg-card flex items-center justify-center">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              Carregando eventos…
            </div>
          </div>
        ) : (
          <WeekTimeGrid
            weekDays={weekDays}
            events={events}
            selectedDate={selectedDate}
            onSelectEvent={setSelectedEvent}
          />
        )}
      </div>

      {/* Modal */}
      {selectedEvent && (
        <EventModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onRefresh={load}
        />
      )}
    </div>
  );
}
