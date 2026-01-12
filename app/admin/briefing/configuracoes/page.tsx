'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { BriefingConfig } from '@/types/briefing';
import { formatDateTime } from '@/lib/utils/format';

export default function BriefingConfigPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [config, setConfig] = useState<Partial<BriefingConfig>>({
    webhook_url: '',
    webhook_secret: '',
    is_active: false,
  });

  useEffect(() => {
    fetchConfig();
  }, []);

  async function fetchConfig() {
    try {
      const response = await fetch('/api/briefing/config');
      const data = await response.json();

      if (!response.ok) throw new Error(data.message);

      setConfig(data.data || {});
    } catch (error: any) {
      console.error('Error fetching config:', error);
      toast.error(error.message || 'Erro ao carregar configuração');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const response = await fetch('/api/briefing/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.message);

      toast.success('Configuração salva com sucesso!');
      setConfig(data.data);
    } catch (error: any) {
      console.error('Error saving config:', error);
      toast.error(error.message || 'Erro ao salvar configuração');
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    try {
      const response = await fetch('/api/briefing/config/test', {
        method: 'POST',
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Webhook testado com sucesso!');
      } else {
        toast.error('Falha ao testar webhook');
      }

      // Atualizar configuração para pegar novo status de teste
      await fetchConfig();
    } catch (error: any) {
      console.error('Error testing webhook:', error);
      toast.error(error.message || 'Erro ao testar webhook');
    } finally {
      setTesting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-shimmer h-8 w-32 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold">⚙️ Configuração de Webhook</h1>
        <p className="text-muted-foreground mt-1">
          Configure o webhook para receber notificações quando leads preencherem o briefing
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Webhook</CardTitle>
          <CardDescription>
            Quando um lead preencher o briefing, o sistema enviará os dados para o webhook configurado.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="webhook_url">🔗 Webhook URL *</Label>
            <Input
              id="webhook_url"
              type="url"
              placeholder="https://n8n.vendai.com/webhook/briefing"
              value={config.webhook_url || ''}
              onChange={(e) => setConfig({ ...config, webhook_url: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="webhook_secret">🔐 Webhook Secret (opcional)</Label>
            <Input
              id="webhook_secret"
              type="text"
              placeholder="abc123xyz"
              value={config.webhook_secret || ''}
              onChange={(e) => setConfig({ ...config, webhook_secret: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Enviado no header x-webhook-secret para validação
            </p>
          </div>

          <div className="flex items-center justify-between border rounded-lg p-4">
            <div>
              <Label>Ativar Webhook</Label>
              <p className="text-xs text-muted-foreground">
                Webhook será chamado automaticamente ao receber briefing
              </p>
            </div>
            <Switch
              checked={config.is_active || false}
              onCheckedChange={(checked) => setConfig({ ...config, is_active: checked })}
            />
          </div>

          <div className="border-t pt-4 space-y-4">
            <div className="flex gap-2">
              <Button onClick={handleTest} disabled={testing || !config.webhook_url} variant="outline">
                {testing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Testando...
                  </>
                ) : (
                  'Testar Webhook'
                )}
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Salvar'
                )}
              </Button>
            </div>

            {config.last_test_at && (
              <div className="flex items-center gap-2 text-sm">
                {config.last_test_status === 'success' ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span className="text-primary">Último teste: Sucesso</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 text-red-500" />
                    <span className="text-red-500">Último teste: Falha</span>
                  </>
                )}
                <span className="text-muted-foreground">
                  ({formatDateTime(config.last_test_at)})
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
