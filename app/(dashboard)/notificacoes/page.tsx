'use client';

import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@/lib/hooks/useUser';
import { createClient } from '@/lib/supabase/client';
import { formatDistanceToNow, isToday, isYesterday, isThisWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils/cn';
import {
  UserPlus, MessageCircle, CreditCard, Settings2, Bell,
  CheckCheck, Loader2, Zap, AlertTriangle, PhoneCall,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Notification {
  id: string;
  type: string;
  message: string;
  created_at: string;
  read: boolean;
}

interface Group {
  label: string;
  items: Notification[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function groupByDay(notifications: Notification[]): Group[] {
  const today: Notification[] = [];
  const yesterday: Notification[] = [];
  const thisWeek: Notification[] = [];
  const older: Notification[] = [];

  for (const n of notifications) {
    const d = new Date(n.created_at);
    if (isToday(d)) today.push(n);
    else if (isYesterday(d)) yesterday.push(n);
    else if (isThisWeek(d, { weekStartsOn: 1 })) thisWeek.push(n);
    else older.push(n);
  }

  const groups: Group[] = [];
  if (today.length) groups.push({ label: 'Hoje', items: today });
  if (yesterday.length) groups.push({ label: 'Ontem', items: yesterday });
  if (thisWeek.length) groups.push({ label: 'Esta semana', items: thisWeek });
  if (older.length) groups.push({ label: 'Anteriores', items: older });
  return groups;
}

function typeConfig(type: string): { icon: React.ElementType; color: string; bg: string } {
  const t = type?.toLowerCase() ?? '';
  if (t.includes('lead') || t.includes('prospect') || t.includes('contato'))
    return { icon: UserPlus, color: 'text-blue-500', bg: 'bg-blue-500/10' };
  if (t.includes('message') || t.includes('mensagem') || t.includes('chat') || t.includes('whatsapp'))
    return { icon: MessageCircle, color: 'text-green-500', bg: 'bg-green-500/10' };
  if (t.includes('payment') || t.includes('pagamento') || t.includes('cobran') || t.includes('plano'))
    return { icon: CreditCard, color: 'text-purple-500', bg: 'bg-purple-500/10' };
  if (t.includes('call') || t.includes('liga') || t.includes('telefo'))
    return { icon: PhoneCall, color: 'text-orange-500', bg: 'bg-orange-500/10' };
  if (t.includes('agent') || t.includes('automac') || t.includes('sequence') || t.includes('flow'))
    return { icon: Zap, color: 'text-yellow-500', bg: 'bg-yellow-500/10' };
  if (t.includes('error') || t.includes('erro') || t.includes('fail') || t.includes('alert'))
    return { icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-500/10' };
  if (t.includes('config') || t.includes('setting') || t.includes('system'))
    return { icon: Settings2, color: 'text-muted-foreground', bg: 'bg-muted' };
  return { icon: Bell, color: 'text-primary', bg: 'bg-primary/10' };
}

// ── NotifItem ─────────────────────────────────────────────────────────────────

function NotifItem({
  notif,
  onRead,
}: {
  notif: Notification;
  onRead: (id: string) => void;
}) {
  const { icon: Icon, color, bg } = typeConfig(notif.type);

  return (
    <div
      className={cn(
        'flex items-start gap-4 px-5 py-4 cursor-pointer transition-colors group',
        !notif.read ? 'bg-primary/[0.03] hover:bg-primary/[0.06]' : 'hover:bg-muted/30'
      )}
      onClick={() => !notif.read && onRead(notif.id)}
    >
      {/* Avatar : ícone do tipo sobre Z da marca */}
      <div className="relative flex-shrink-0 mt-0.5">
        <div className={cn('w-9 h-9 rounded-full flex items-center justify-center', bg)}>
          <Icon className={cn('h-4 w-4', color)} />
        </div>
        {/* Z badge da marca no canto */}
        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-primary flex items-center justify-center ring-2 ring-background">
          <span className="text-[8px] font-black text-primary-foreground leading-none">Z</span>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm leading-snug', !notif.read ? 'text-foreground font-medium' : 'text-foreground/80')}>
          {notif.message}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true, locale: ptBR })}
          </span>
          {!notif.read && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary bg-primary/10 rounded-full px-2 py-0.5 leading-none">
              Nova
            </span>
          )}
        </div>
      </div>

      {/* Dot de não lida */}
      {!notif.read && (
        <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-2" />
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function NotificacoesPage() {
  const { company } = useUser();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!company?.id) return;
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false });
      if (data) {
        setNotifications(data.map((log: any) => ({
          id: log.id,
          type: log.action,
          message: log.description,
          created_at: log.created_at,
          read: log.read || false,
        })));
      }
    } catch { /* noop */ } finally {
      setLoading(false);
    }
  }, [company?.id]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  const markAsRead = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: 'POST' });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } catch { /* noop */ }
  };

  const markAllAsRead = async () => {
    setMarkingAll(true);
    try {
      const unread = notifications.filter(n => !n.read);
      await Promise.all(unread.map(n => fetch(`/api/notifications/${n.id}/read`, { method: 'POST' })));
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch { /* noop */ } finally {
      setMarkingAll(false);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;
  const groups = groupByDay(notifications);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Carregando notificações...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto pb-20">

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notificações</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {unreadCount > 0
              ? `${unreadCount} não lida${unreadCount !== 1 ? 's' : ''}`
              : 'Tudo em dia'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            disabled={markingAll}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            {markingAll
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <CheckCheck className="h-3.5 w-3.5" />}
            Marcar todas como lidas
          </button>
        )}
      </div>

      {/* Feed */}
      {notifications.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-20 flex flex-col items-center gap-4 text-center">
          {/* Z brand vazio */}
          <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
            <span className="text-2xl font-black text-muted-foreground/30 leading-none">Z</span>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Nenhuma notificação</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Quando algo acontecer, você verá aqui.</p>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border/50">
          {groups.map((group, gi) => (
            <div key={group.label}>
              {/* Separador de grupo */}
              <div className={cn(
                'px-5 py-2 bg-muted/30',
                gi > 0 && 'border-t border-border/50'
              )}>
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {group.label}
                </span>
              </div>
              <div className="divide-y divide-border/30">
                {group.items.map(n => (
                  <NotifItem key={n.id} notif={n} onRead={markAsRead} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
