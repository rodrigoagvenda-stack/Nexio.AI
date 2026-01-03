'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  UserCircle,
  MessageSquare,
  CheckCircle,
  Clock,
  AlertCircle,
} from 'lucide-react';

interface UserMetrics {
  user_id: number;
  user_name: string;
  user_email: string;
  total_assigned_chats: number;
  active_chats: number;
  resolved_chats: number;
  chats_with_unread: number;
  messages_sent: number;
  resolution_rate_percent: number;
  avg_response_time_minutes?: number;
}

interface UserPerformanceCardProps {
  user: UserMetrics;
}

export function UserPerformanceCard({ user }: UserPerformanceCardProps) {
  const formatResponseTime = (minutes?: number) => {
    if (!minutes) return 'N/A';

    if (minutes < 60) {
      return `${Math.round(minutes)}min`;
    }

    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}min`;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserCircle className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle className="text-base">{user.user_name}</CardTitle>
              <p className="text-xs text-muted-foreground">{user.user_email}</p>
            </div>
          </div>
          {user.chats_with_unread > 0 && (
            <Badge variant="destructive" className="text-xs">
              <AlertCircle className="h-3 w-3 mr-1" />
              {user.chats_with_unread}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Chats Ativos</span>
            </div>
            <p className="text-2xl font-bold">{user.active_chats}</p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Resolvidos</span>
            </div>
            <p className="text-2xl font-bold">{user.resolved_chats}</p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Msgs Enviadas</span>
            </div>
            <p className="text-2xl font-bold">{user.messages_sent}</p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Tempo Médio</span>
            </div>
            <p className="text-lg font-bold">
              {formatResponseTime(user.avg_response_time_minutes)}
            </p>
          </div>
        </div>

        {/* Resolution Rate */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Taxa de Resolução</span>
            <span className="font-bold">{user.resolution_rate_percent?.toFixed(1) || '0.0'}%</span>
          </div>
          <Progress value={user.resolution_rate_percent || 0} className="h-2" />
        </div>

        {/* Summary */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
          <span>Total Atribuído</span>
          <span className="font-medium">{user.total_assigned_chats} chats</span>
        </div>
      </CardContent>
    </Card>
  );
}
