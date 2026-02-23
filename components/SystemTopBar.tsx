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

interface Notification {
  id: string;
  type: string;
  message: string;
  created_at: string;
  read: boolean;
}

export function SystemTopBar() {
  const { user, company } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const [notifications, setNotifications] = useState<Notification[]>([]);
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
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching notifications:', error);
        return;
      }

      if (data) {
        const formatted = data.map((log: any) => ({
          id: log.id,
          type: log.action,
          message: log.description,
          created_at: log.created_at,
          read: log.read || false,
        }));
        setNotifications(formatted);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  }, [company?.id]);

  const markAsRead = async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'POST',
      });

      if (response.ok) {
        // Atualizar localmente
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notificationId ? { ...n, read: true } : n
          )
        );
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative h-9 w-9 md:h-10 md:w-10">
                <Bell className="h-4 w-4 md:h-5 md:w-5" />
                {unreadCount > 0 && (
                  <Badge
                    variant="destructive"
                    className="absolute -top-1 -right-1 h-4 w-4 md:h-5 md:w-5 flex items-center justify-center p-0 text-[10px] md:text-xs"
                  >
                    {unreadCount}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <div className="p-3 border-b">
                <h3 className="font-semibold text-sm">Notificações</h3>
                <p className="text-xs text-muted-foreground">
                  {unreadCount} não lida{unreadCount !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="max-h-[400px] overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    Nenhuma notificação ainda
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <DropdownMenuItem
                      key={notif.id}
                      className="flex-col items-start p-3 cursor-pointer"
                      onClick={() => markAsRead(notif.id)}
                    >
                      <div className="flex items-start gap-2 w-full">
                        <div className={`h-2 w-2 rounded-full mt-1.5 ${!notif.read ? 'bg-primary' : 'bg-muted'}`} />
                        <div className="flex-1">
                          <p className="text-sm font-medium">{notif.message}</p>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(notif.created_at), {
                              addSuffix: true,
                              locale: ptBR,
                            })}
                          </span>
                        </div>
                      </div>
                    </DropdownMenuItem>
                  ))
                )}
              </div>
              {notifications.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="justify-center text-sm text-primary cursor-pointer"
                    onClick={() => router.push('/notificacoes')}
                  >
                    Ver todas as notificações
                  </DropdownMenuItem>
                </>
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
