'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar, Clock } from 'lucide-react';

interface ScheduleMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: string;
  onSchedule: (date: string, time: string) => Promise<void>;
}

export function ScheduleMessageDialog({
  open,
  onOpenChange,
  message,
  onSchedule,
}: ScheduleMessageDialogProps) {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [scheduling, setScheduling] = useState(false);

  // Definir data mínima como hoje
  const today = new Date().toISOString().split('T')[0];

  // Definir hora mínima como agora (se for hoje)
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  async function handleSchedule() {
    if (!date || !time) return;

    // Validar se é uma data/hora futura
    const scheduledDateTime = new Date(`${date}T${time}`);
    if (scheduledDateTime <= new Date()) {
      alert('A data e hora devem ser futuras');
      return;
    }

    // Alertar se for fora do horário comercial (8h-18h)
    const hours = scheduledDateTime.getHours();
    if (hours < 8 || hours >= 18) {
      const confirmNonBusinessHours = confirm(
        'Este horário está fora do horário comercial (8h-18h). Deseja continuar?'
      );
      if (!confirmNonBusinessHours) return;
    }

    setScheduling(true);
    try {
      await onSchedule(date, time);
      onOpenChange(false);
      setDate('');
      setTime('');
    } catch (error) {
      console.error('Error scheduling message:', error);
    } finally {
      setScheduling(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Agendar Envio</DialogTitle>
          <DialogDescription>
            Defina quando esta mensagem deve ser enviada
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Preview da mensagem */}
          <div className="rounded-lg border p-3 bg-muted/50">
            <p className="text-sm font-medium mb-1">Mensagem:</p>
            <p className="text-sm text-muted-foreground line-clamp-3">{message}</p>
          </div>

          {/* Data */}
          <div className="space-y-2">
            <Label htmlFor="schedule-date" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Data
            </Label>
            <Input
              id="schedule-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              min={today}
              disabled={scheduling}
            />
          </div>

          {/* Hora */}
          <div className="space-y-2">
            <Label htmlFor="schedule-time" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Hora
            </Label>
            <Input
              id="schedule-time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              min={date === today ? currentTime : undefined}
              disabled={scheduling}
            />
          </div>

          {date && time && (
            <div className="rounded-lg border p-3 bg-primary/5">
              <p className="text-sm">
                <strong>Será enviado em:</strong>{' '}
                {new Date(`${date}T${time}`).toLocaleString('pt-BR', {
                  dateStyle: 'full',
                  timeStyle: 'short',
                })}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={scheduling}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSchedule}
            disabled={!date || !time || scheduling}
            className="bg-[#005c4b] hover:bg-[#004d3d]"
          >
            {scheduling ? 'Agendando...' : 'Agendar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
