'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Save, Loader2 } from 'lucide-react';

interface AutomationSettings {
  id?: number;
  company_id: number;
  welcome_message: string;
  welcome_enabled: boolean;
  away_message: string;
  away_enabled: boolean;
  after_hours_message: string;
  after_hours_enabled: boolean;
  auto_assign_enabled: boolean;
  auto_assign_strategy: string;
  availability_status: string;
}

interface AutomationMessagesProps {
  companyId: number;
}

export function AutomationMessages({ companyId }: AutomationMessagesProps) {
  const [settings, setSettings] = useState<AutomationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, [companyId]);

  async function fetchSettings() {
    setLoading(true);
    try {
      const res = await fetch(`/api/automation/settings?companyId=${companyId}`);
      const data = await res.json();

      if (data.success) {
        setSettings(data.settings);
      } else {
        toast.error('Erro ao carregar configurações');
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('Erro ao carregar configurações');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!settings) return;

    setSaving(true);
    try {
      const res = await fetch('/api/automation/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, ...settings }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success('Configurações salvas com sucesso');
        setSettings(data.settings);
      } else {
        toast.error('Erro ao salvar configurações');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!settings) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Erro ao carregar configurações</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Welcome Message */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Mensagem de Boas-Vindas</CardTitle>
              <CardDescription>
                Enviada automaticamente quando um novo contato inicia conversa
              </CardDescription>
            </div>
            <Switch
              checked={settings.welcome_enabled}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, welcome_enabled: checked })
              }
            />
          </div>
        </CardHeader>
        <CardContent>
          <Textarea
            value={settings.welcome_message}
            onChange={(e) =>
              setSettings({ ...settings, welcome_message: e.target.value })
            }
            placeholder="Digite a mensagem de boas-vindas..."
            rows={3}
            disabled={!settings.welcome_enabled}
          />
        </CardContent>
      </Card>

      {/* Away Message */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Mensagem de Ausência</CardTitle>
              <CardDescription>
                Enviada quando seu status está definido como "Ausente"
              </CardDescription>
            </div>
            <Switch
              checked={settings.away_enabled}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, away_enabled: checked })
              }
            />
          </div>
        </CardHeader>
        <CardContent>
          <Textarea
            value={settings.away_message}
            onChange={(e) =>
              setSettings({ ...settings, away_message: e.target.value })
            }
            placeholder="Digite a mensagem de ausência..."
            rows={3}
            disabled={!settings.away_enabled}
          />
        </CardContent>
      </Card>

      {/* After Hours Message */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Mensagem Fora do Horário</CardTitle>
              <CardDescription>
                Enviada quando uma mensagem é recebida fora do horário de atendimento
              </CardDescription>
            </div>
            <Switch
              checked={settings.after_hours_enabled}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, after_hours_enabled: checked })
              }
            />
          </div>
        </CardHeader>
        <CardContent>
          <Textarea
            value={settings.after_hours_message}
            onChange={(e) =>
              setSettings({ ...settings, after_hours_message: e.target.value })
            }
            placeholder="Digite a mensagem fora do horário..."
            rows={3}
            disabled={!settings.after_hours_enabled}
          />
        </CardContent>
      </Card>

      {/* Auto Assignment */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Atribuição Automática</CardTitle>
              <CardDescription>
                Atribui automaticamente novos chats aos membros da equipe
              </CardDescription>
            </div>
            <Switch
              checked={settings.auto_assign_enabled}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, auto_assign_enabled: checked })
              }
            />
          </div>
        </CardHeader>
        {settings.auto_assign_enabled && (
          <CardContent>
            <Label>Estratégia de Atribuição</Label>
            <select
              className="w-full mt-2 p-2 border rounded-md"
              value={settings.auto_assign_strategy}
              onChange={(e) =>
                setSettings({ ...settings, auto_assign_strategy: e.target.value })
              }
            >
              <option value="round_robin">Round Robin (Alternado)</option>
              <option value="least_active">Menos Ocupado</option>
              <option value="random">Aleatório</option>
            </select>
          </CardContent>
        )}
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
              Salvar Configurações
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
