'use client';

import { useUser } from '@/lib/hooks/useUser';
import { Bell, Settings, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useRouter, usePathname } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

type NotifTab = 'todas' | 'mensagens' | 'sistema';

interface Notification {
  id: string;
  type: 'message' | 'system';
  title: string;
  message: string;
  created_at: string;
  read: boolean;
  photo?: string | null;
}

export function SystemTopBar() {
  const { user, company } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [activeTab, setActiveTab] = useState<NotifTab>('todas');
  const [notifOpen, setNotifOpen] = useState(false);

  const userName = user?.name || 'Usuário';
  const userEmail = user?.email || '';
  const userInitials = userName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const avatarUrl = (user as any)?.avatar_url || (user as any)?.photo_url || company?.image_url || null;

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    toast({ title: 'Logout realizado com sucesso!' });
    router.push('/login');
    router.refresh();
  };

  const fetchNotifications = useCallback(async () => {
    if (!company?.id) return;
    try {
      const supabase = createClient();
      const msgLastSeen = localStorage.getItem('notif_msg_last_seen');

      const [{ data: logs }, { data: msgs }] = await Promise.all([
        supabase
          .from('activity_logs')
          .select('id, action, description, created_at, read')
          .eq('company_id', company.id)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('mensagens_do_whatsapp')
          .select('id, texto_da_mensagem, carimbo_de_data_e_hora, conversas_do_whatsapp(nome_do_contato, whatsapp_photo_url)')
          .eq('company_id', company.id)
          .eq('direcao', 'inbound')
          .order('carimbo_de_data_e_hora', { ascending: false })
          .limit(15),
      ]);

      const sysNotifs: Notification[] = (logs ?? []).map((log: any) => ({
        id: `sys-${log.id}`,
        type: 'system' as const,
        title: 'Sistema',
        message: log.description ?? log.action,
        created_at: log.created_at,
        read: log.read || false,
      }));

      const msgNotifs: Notification[] = (msgs ?? []).map((msg: any) => ({
        id: `msg-${msg.id}`,
        type: 'message' as const,
        title: msg.conversas_do_whatsapp?.nome_do_contato || 'Nova mensagem',
        message: msg.texto_da_mensagem || '📎 Mídia',
        created_at: msg.carimbo_de_data_e_hora,
        photo: msg.conversas_do_whatsapp?.whatsapp_photo_url ?? null,
        read: msgLastSeen ? new Date(msg.carimbo_de_data_e_hora) <= new Date(msgLastSeen) : false,
      }));

      setNotifications([...msgNotifs, ...sysNotifs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
    } catch {}
  }, [company?.id]);

  const markAllMsgRead = () => {
    localStorage.setItem('notif_msg_last_seen', new Date().toISOString());
    setNotifications((prev) => prev.map((n) => n.type === 'message' ? { ...n, read: true } : n));
  };

  const markAsRead = async (notif: Notification) => {
    if (notif.type === 'message') {
      markAllMsgRead();
      return;
    }
    const rawId = notif.id.replace('sys-', '');
    try {
      await fetch(`/api/notifications/${rawId}/read`, { method: 'POST' });
      setNotifications((prev) => prev.map((n) => n.id === notif.id ? { ...n, read: true } : n));
    } catch {}
  };

  useEffect(() => {
    if (company?.id) {
      fetchNotifications();

      const supabase = createClient();
      const channel = supabase
        .channel('activity_logs')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'activity_logs',
            filter: `company_id=eq.${company.id}`,
          },
          () => { fetchNotifications(); }
        )
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    }
  }, [company?.id, fetchNotifications]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  if (pathname?.includes('/configuracoes')) {
    return null;
  }

  return (
    <header
      className="mx-4 mt-3 mb-1 h-[80px] rounded-xl flex items-center justify-between px-5 flex-shrink-0"
      style={{
        background: 'linear-gradient(270deg, #01573C 0%, #07261C 100%)',
      }}
    >
      {/* Left: User info */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div
          className="w-12 h-12 rounded-full flex-shrink-0 overflow-hidden bg-white/20 flex items-center justify-center"
          style={{ border: '2px solid #90FC1D' }}
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt={userName} className="w-full h-full object-cover" />
          ) : (
            <span className="text-base font-bold" style={{ color: '#D4D4D4' }}>{userInitials}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold leading-none truncate" style={{ color: '#D4D4D4' }}>{userName}</p>
          <p className="text-sm font-medium truncate mt-1" style={{ color: '#D4D4D4', opacity: 0.6 }}>{userEmail}</p>
        </div>
      </div>

      {/* Right: Notifications + Settings */}
      <div className="flex items-center gap-0.5 flex-shrink-0">
        {/* Notifications */}
        <DropdownMenu open={notifOpen} onOpenChange={(open) => { setNotifOpen(open); if (open) fetchNotifications(); }}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative h-10 w-10 text-white/70 hover:text-white hover:bg-white/10">
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <Badge
                  variant="destructive"
                  className="absolute -top-1 -right-1 h-4 w-4 flex items-center justify-center p-0 text-[10px]"
                >
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[340px] p-0 overflow-hidden">
            {/* Header */}
            <div className="px-4 pt-4 pb-3 border-b border-border">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm">Notificações</h3>
                {unreadCount > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-destructive/15 text-destructive font-medium">
                    {unreadCount} nova{unreadCount !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <div className="flex gap-1">
                {(['todas', 'mensagens', 'sistema'] as NotifTab[]).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      'flex-1 py-1.5 rounded-lg text-[11px] font-medium transition-colors capitalize',
                      activeTab === tab
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                    )}
                  >
                    {tab === 'todas' ? 'Todas' : tab === 'mensagens' ? 'Mensagens' : 'Sistema'}
                  </button>
                ))}
              </div>
            </div>

            {/* List */}
            <div className="max-h-[380px] overflow-y-auto">
              {(() => {
                const filtered = notifications.filter(n =>
                  activeTab === 'todas' ? true :
                  activeTab === 'mensagens' ? n.type === 'message' :
                  n.type === 'system'
                );
                if (filtered.length === 0) {
                  return (
                    <div className="py-10 text-center text-sm text-muted-foreground/60">
                      Nenhuma notificação
                    </div>
                  );
                }
                return filtered.map((notif) => (
                  <button
                    key={notif.id}
                    className={cn(
                      'w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-accent/50 transition-colors border-b border-border/40 last:border-0',
                      !notif.read && 'bg-primary/5'
                    )}
                    onClick={() => markAsRead(notif)}
                  >
                    {notif.type === 'message' ? (
                      <Avatar className="flex-shrink-0 w-8 h-8 mt-0.5">
                        <AvatarImage src={notif.photo ?? undefined} />
                        <AvatarFallback className="bg-primary/15 text-primary text-[11px] font-bold">
                          {notif.title.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    ) : (
                      <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold mt-0.5 bg-muted text-muted-foreground">
                        ⚙
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-foreground truncate">{notif.title}</p>
                        <span className="text-[10px] text-muted-foreground/60 flex-shrink-0">
                          {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true, locale: ptBR })}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground/80 line-clamp-2 mt-0.5">{notif.message}</p>
                    </div>
                    {!notif.read && (
                      <div className="flex-shrink-0 w-2 h-2 rounded-full bg-primary mt-2" />
                    )}
                  </button>
                ));
              })()}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="border-t border-border p-2">
                <button
                  onClick={() => { router.push('/atendimento'); setNotifOpen(false); }}
                  className="w-full py-2 text-xs text-primary font-medium hover:bg-accent/50 rounded-lg transition-colors"
                >
                  Ver todas as mensagens
                </button>
              </div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Settings */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-10 w-10 text-white/70 hover:text-white hover:bg-white/10">
              <Settings className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={() => router.push('/configuracoes')}>
              <Settings className="mr-2 h-4 w-4" />
              <span>Configurações</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Sair</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
