'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Save, Loader2 } from 'lucide-react';

interface BusinessHour {
  id?: number;
  company_id: number;
  day_of_week: number;
  is_enabled: boolean;
  start_time: string;
  end_time: string;
  timezone: string;
}

interface BusinessHoursConfigProps {
  companyId: number;
}

const DAYS = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
];

export function BusinessHoursConfig({ companyId }: BusinessHoursConfigProps) {
  const [hours, setHours] = useState<BusinessHour[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchHours();
  }, [companyId]);

  async function fetchHours() {
    setLoading(true);
    try {
      const res = await fetch(`/api/automation/business-hours?companyId=${companyId}`);
      const data = await res.json();

      if (data.success) {
        setHours(data.hours);
      } else {
        toast.error('Erro ao carregar horários');
      }
    } catch (error) {
      console.error('Error fetching hours:', error);
      toast.error('Erro ao carregar horários');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch('/api/automation/business-hours', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, hours }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success('Horários salvos com sucesso');
        setHours(data.hours);
      } else {
        toast.error('Erro ao salvar horários');
      }
    } catch (error) {
      console.error('Error saving hours:', error);
      toast.error('Erro ao salvar horários');
    } finally {
      setSaving(false);
    }
  }

  function updateHour(dayOfWeek: number, field: keyof BusinessHour, value: any) {
    setHours(
      hours.map((h) =>
        h.day_of_week === dayOfWeek ? { ...h, [field]: value } : h
      )
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Horário de Atendimento</CardTitle>
          <CardDescription>
            Configure os dias e horários em que sua equipe está disponível
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {hours
            .sort((a, b) => a.day_of_week - b.day_of_week)
            .map((hour) => (
              <div
                key={hour.day_of_week}
                className="flex items-center gap-4 p-4 border rounded-lg"
              >
                <div className="flex items-center gap-3 flex-1">
                  <Switch
                    checked={hour.is_enabled}
                    onCheckedChange={(checked) =>
                      updateHour(hour.day_of_week, 'is_enabled', checked)
                    }
                  />
                  <Label className="w-32 font-medium">
                    {DAYS[hour.day_of_week]}
                  </Label>
                </div>

                {hour.is_enabled && (
                  <div className="flex items-center gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Início</Label>
                      <Input
                        type="time"
                        value={hour.start_time}
                        onChange={(e) =>
                          updateHour(hour.day_of_week, 'start_time', e.target.value)
                        }
                        className="w-32"
                      />
                    </div>
                    <span className="text-muted-foreground">até</span>
                    <div>
                      <Label className="text-xs text-muted-foreground">Fim</Label>
                      <Input
                        type="time"
                        value={hour.end_time}
                        onChange={(e) =>
                          updateHour(hour.day_of_week, 'end_time', e.target.value)
                        }
                        className="w-32"
                      />
                    </div>
                  </div>
                )}

                {!hour.is_enabled && (
                  <span className="text-sm text-muted-foreground">Fechado</span>
                )}
              </div>
            ))}
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Salvar Horários
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
