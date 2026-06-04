'use client';

import { useUser } from '@/lib/hooks/useUser';
import { Bell, Settings, LogOut, User as UserIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverBody,
} from '@/components/ui/popover';
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
  const [settingsOpen, setSettingsOpen] = useState(false);

  const userName = user?.name || 'Usuário';
  const userEmail = user?.email || '';
  const userInitials = userName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

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

      // Subscribe to realtime notifications
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
          () => {
            fetchNotifications();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [company?.id, fetchNotifications]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Hide on config page
  if (pathname?.includes('/configuracoes')) {
    return null;
  }

  return (
    <div className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border w-full">
      <div className="flex items-center justify-between h-20 px-3 md:px-6 w-full min-w-0">
        {/* Left: User info */}
        <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
          <Avatar className="h-8 w-8 md:h-10 md:w-10 flex-shrink-0">
            {user?.photo_url ? (
              <AvatarImage src={user.photo_url} alt={userName} className="object-cover" />
            ) : null}
            <AvatarFallback className="bg-primary text-primary-foreground text-xs md:text-sm font-semibold">
              {userInitials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <h2 className="text-xs md:text-sm font-semibold flex items-center gap-1 truncate">
              Olá, {userName.split(' ')[0]} ✌️
            </h2>
            <p className="text-[10px] md:text-xs text-muted-foreground truncate">{userEmail}</p>
          </div>
        </div>

        {/* Right: Notifications + Settings */}
        <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
          {/* Notifications */}
          <DropdownMenu open={notifOpen} onOpenChange={(open) => { setNotifOpen(open); if (open) fetchNotifications(); }}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative h-9 w-9 md:h-10 md:w-10">
                <Bell className="h-4 w-4 md:h-5 md:w-5" />
                {unreadCount > 0 && (
                  <Badge
                    variant="destructive"
                    className="absolute -top-1 -right-1 h-4 w-4 md:h-5 md:w-5 flex items-center justify-center p-0 text-[10px] md:text-xs"
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
                {/* Tabs */}
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
                      {/* Avatar */}
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
          <Popover open={settingsOpen} onOpenChange={setSettingsOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="relative h-9 w-9 md:h-10 md:w-10">
                <Settings
                  className={`h-4 w-4 md:h-5 md:w-5 transition-transform duration-300 ${
                    settingsOpen ? 'rotate-180' : ''
                  }`}
                />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56 p-0">
              <PopoverBody className="p-0">
                <div className="flex flex-col">
                  <button
                    onClick={() => {
                      setSettingsOpen(false);
                      router.push('/configuracoes');
                    }}
                    className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-accent transition-colors text-left"
                  >
                    <Settings className="h-4 w-4" />
                    <span>Configurações</span>
                  </button>
                  <div className="h-px bg-border" />
                  <button
                    onClick={() => {
                      setSettingsOpen(false);
                      handleLogout();
                    }}
                    className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-accent transition-colors text-left text-destructive"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Sair</span>
                  </button>
                </div>
              </PopoverBody>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
}
