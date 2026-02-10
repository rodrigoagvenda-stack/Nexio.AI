'use client';

import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@/lib/hooks/useUser';
import { OrbitCard, OrbitCardContent, OrbitCardHeader, OrbitCardTitle } from '@/components/ui/orbit-card';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { createClient } from '@/lib/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { Bell, CheckCheck, Loader2 } from 'lucide-react';

interface Notification {
  id: string;
  type: string;
  message: string;
  created_at: string;
  read: boolean;
}

export default function NotificacoesPage() {
  const { company } = useUser();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAllRead, setMarkingAllRead] = useState(false);

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
    } finally {
      setLoading(false);
    }
  }, [company?.id]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markAsRead = async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'POST',
      });

      if (response.ok) {
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

  const markAllAsRead = async () => {
    setMarkingAllRead(true);
    try {
      const unreadIds = notifications.filter(n => !n.read).map(n => n.id);

      await Promise.all(
        unreadIds.map(id =>
          fetch(`/api/notifications/${id}/read`, { method: 'POST' })
        )
      );

      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read: true }))
      );

      toast.success('Todas as notificações marcadas como lidas');
    } catch (error) {
      console.error('Error marking all as read:', error);
      toast.error('Erro ao marcar notificações como lidas');
    } finally {
      setMarkingAllRead(false);
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Notificações</h1>
          <p className="text-muted-foreground mt-1">
            {unreadCount} não lida{unreadCount !== 1 ? 's' : ''}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            onClick={markAllAsRead}
            disabled={markingAllRead}
            variant="outline"
          >
            {markingAllRead ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Marcando...
              </>
            ) : (
              <>
                <CheckCheck className="mr-2 h-4 w-4" />
                Marcar todas como lidas
              </>
            )}
          </Button>
        )}
      </div>

      <OrbitCard>
        <OrbitCardContent className="p-0">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="p-4 bg-muted rounded-full mb-4">
                <Bell className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Nenhuma notificação</h3>
              <p className="text-sm text-muted-foreground">
                Você não tem notificações no momento
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.08]">
              {notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`p-4 hover:bg-white/[0.02] transition-colors cursor-pointer ${
                    !notif.read ? 'bg-primary/5' : ''
                  }`}
                  onClick={() => !notif.read && markAsRead(notif.id)}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`h-2 w-2 rounded-full mt-2 flex-shrink-0 ${
                        !notif.read ? 'bg-primary' : 'bg-muted'
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{notif.message}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(notif.created_at), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </span>
                        {!notif.read && (
                          <Badge variant="default" className="text-xs px-2 py-0">
                            Nova
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </OrbitCardContent>
      </OrbitCard>
    </div>
  );
}
