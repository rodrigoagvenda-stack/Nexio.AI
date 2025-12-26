'use client';

import { useUser } from '@/lib/hooks/useUser';
import { Bell, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useRouter, usePathname } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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
  const [settingsRotating, setSettingsRotating] = useState(false);

  // Hide on config page
  if (pathname?.includes('/configuracoes')) {
    return null;
  }

  const userName = user?.name || 'Usuário';
  const userEmail = user?.email || '';
  const userInitials = userName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

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
  }, [company?.id]);

  async function fetchNotifications() {
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('company_id', company?.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (data) {
        const formatted = data.map((log: any) => ({
          id: log.id,
          type: log.action,
          message: log.description,
          created_at: log.created_at,
          read: false,
        }));
        setNotifications(formatted);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  }

  const handleSettingsClick = () => {
    setSettingsRotating(true);
    setTimeout(() => {
      router.push('/configuracoes');
      setTimeout(() => setSettingsRotating(false), 300);
    }, 300);
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
      <div className="flex items-center justify-between h-16 px-6">
        {/* Left: User info */}
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">
              {userInitials}
            </AvatarFallback>
          </Avatar>
          <div>
            <h2 className="text-sm font-semibold flex items-center gap-1">
              Olá, {userName} ✌️
            </h2>
            <p className="text-xs text-muted-foreground">{userEmail}</p>
          </div>
        </div>

        {/* Right: Notifications + Settings */}
        <div className="flex items-center gap-2">
          {/* Notifications */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <Badge
                    variant="destructive"
                    className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
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
                  <DropdownMenuItem className="justify-center text-sm text-primary cursor-pointer">
                    Ver todas as notificações
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Settings */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSettingsClick}
            className="relative"
          >
            <Settings
              className={`h-5 w-5 transition-transform duration-300 ${
                settingsRotating ? 'rotate-180' : ''
              }`}
            />
          </Button>
        </div>
      </div>
    </div>
  );
}
