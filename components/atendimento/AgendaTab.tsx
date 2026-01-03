'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, X, Edit2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatDateTime } from '@/lib/utils/format';

interface ScheduledMessage {
  id: number;
  content: string;
  scheduled_for: string;
  type: string;
  status: string;
  creator?: {
    name: string;
  };
}

interface AgendaTabProps {
  chatId: number;
  leadId?: number;
  companyId: number;
}

export function AgendaTab({ chatId, leadId, companyId }: AgendaTabProps) {
  const [scheduledMessages, setScheduledMessages] = useState<ScheduledMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  useEffect(() => {
    fetchScheduledMessages();
  }, [chatId]);

  async function fetchScheduledMessages() {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        companyId: companyId.toString(),
        chatId: chatId.toString(),
        status: 'pending',
      });

      const response = await fetch(`/api/messages/scheduled?${params}`);
      const data = await response.json();

      if (data.success) {
        setScheduledMessages(data.data);
      }
    } catch (error) {
      console.error('Error fetching scheduled messages:', error);
      toast.error('Erro ao carregar agendamentos');
    } finally {
      setLoading(false);
    }
  }

  async function handleCancelSchedule(id: number) {
    if (!confirm('Deseja realmente cancelar este agendamento?')) return;

    setCancellingId(id);
    try {
      const response = await fetch(`/api/messages/scheduled/${id}?companyId=${companyId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        setScheduledMessages(prev => prev.filter(msg => msg.id !== id));
        toast.success('Agendamento cancelado');
      } else {
        throw new Error(data.message);
      }
    } catch (error: any) {
      console.error('Error cancelling schedule:', error);
      toast.error(error.message || 'Erro ao cancelar agendamento');
    } finally {
      setCancellingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (scheduledMessages.length === 0) {
    return (
      <div className="text-center py-8">
        <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">
          Nenhuma mensagem agendada
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">Mensagens Agendadas ({scheduledMessages.length})</p>

      {scheduledMessages.map((msg) => (
        <div
          key={msg.id}
          className="border rounded-lg p-3 space-y-2 hover:bg-accent/50 transition-colors"
        >
          {/* Header com data/hora */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="font-medium">
                {new Date(msg.scheduled_for).toLocaleString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
            <Badge variant="secondary" className="text-xs">
              {msg.type === 'text' ? '📝 Texto' : '📎 Mídia'}
            </Badge>
          </div>

          {/* Conteúdo */}
          <p className="text-sm text-muted-foreground line-clamp-2">
            {msg.content}
          </p>

          {/* Ações */}
          <div className="flex items-center justify-between pt-2 border-t">
            <span className="text-xs text-muted-foreground">
              {msg.creator?.name || 'Você'}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleCancelSchedule(msg.id)}
              disabled={cancellingId === msg.id}
              className="h-8 text-destructive hover:text-destructive"
            >
              {cancellingId === msg.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <X className="h-4 w-4 mr-1" />
                  Cancelar
                </>
              )}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
