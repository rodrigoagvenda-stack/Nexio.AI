'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/use-toast';
import { Loader2, Clock, Save } from 'lucide-react';

const DAYS = [
  { id: 0, label: 'Domingo' },
  { id: 1, label: 'Segunda-feira' },
  { id: 2, label: 'Terça-feira' },
  { id: 3, label: 'Quarta-feira' },
  { id: 4, label: 'Quinta-feira' },
  { id: 5, label: 'Sexta-feira' },
  { id: 6, label: 'Sábado' },
];

interface DayConfig {
  day_of_week: number;
  open_time: string;
  close_time: string;
  closed: boolean;
}

const DEFAULT_HOURS: DayConfig[] = DAYS.map(d => ({
  day_of_week: d.id,
  open_time: '08:00',
  close_time: '18:00',
  closed: d.id === 0 || d.id === 6,
}));

const DEFAULT_MESSAGE = 'No momento estamos fora do horário de atendimento. Assim que reabrirmos, um de nossos atendentes ou nosso assistente virtual dará continuidade à conversa.';

export function HorarioContent() {
  const [hours, setHours] = useState<DayConfig[]>(DEFAULT_HOURS);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/business-hours')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.data && d.data.length > 0) {
          const merged = DEFAULT_HOURS.map(def => {
            const saved = d.data.find((row: DayConfig) => row.day_of_week === def.day_of_week);
            return saved ?? def;
          });
          setHours(merged);
        }
        setMessage(d?.message ?? '');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const updateDay = (day: number, patch: Partial<DayConfig>) => {
    setHours(prev => prev.map(h => h.day_of_week === day ? { ...h, ...patch } : h));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/business-hours', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hours, message }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast({ title: 'Horários salvos!' });
    } catch (err: any) {
      toast({ title: err.message || 'Erro ao salvar', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Configure os horários em que o Zaapply aceita novos atendimentos. Fora desse horário, o SDR responde com uma mensagem de ausência e a conversa fica em fila.
      </p>

      <div className="space-y-2">
        {DAYS.map(day => {
          const config = hours.find(h => h.day_of_week === day.id) ?? DEFAULT_HOURS[day.id];
          return (
            <div
              key={day.id}
              className="flex items-center gap-4 p-3 rounded-xl border border-border bg-card"
            >
              <div className="w-32 shrink-0">
                <p className="text-sm font-medium">{day.label}</p>
              </div>

              <Switch
                checked={!config.closed}
                onCheckedChange={(v) => updateDay(day.id, { closed: !v })}
                className="scale-90"
              />

              {config.closed ? (
                <span className="text-xs text-muted-foreground">Fechado</span>
              ) : (
                <div className="flex items-center gap-2 flex-1">
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <input
                      type="time"
                      value={config.open_time}
                      onChange={e => updateDay(day.id, { open_time: e.target.value })}
                      className="bg-muted text-sm rounded-lg border border-border px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                    />
                  </div>
                  <span className="text-muted-foreground text-xs">até</span>
                  <input
                    type="time"
                    value={config.close_time}
                    onChange={e => updateDay(day.id, { close_time: e.target.value })}
                    className="bg-muted text-sm rounded-lg border border-border px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Mensagem de ausência (enviada fora do horário)</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={DEFAULT_MESSAGE}
          rows={3}
          className="w-full resize-none text-sm rounded-xl border border-border bg-card px-3 py-2 text-foreground outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50"
        />
        <p className="text-xs text-muted-foreground">Se deixar em branco, enviamos a mensagem padrão acima.</p>
      </div>

      <Button onClick={handleSave} disabled={saving} size="sm" className="gap-2">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Salvar horários
      </Button>
    </div>
  );
}
