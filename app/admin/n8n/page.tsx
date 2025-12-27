'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Webhook, Check } from 'lucide-react';

interface WebhookConfig {
  id: number;
  webhook_type: string;
  webhook_url: string;
  auth_type: string;
  auth_username: string | null;
  auth_password: string | null;
  is_active: boolean;
}

export default function N8NConfigPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<WebhookConfig | null>(null);
  const [formData, setFormData] = useState({
    webhook_url: '',
    auth_username: '',
    auth_password: '',
  });

  useEffect(() => {
    fetchConfig();
  }, []);

  async function fetchConfig() {
    try {
      const response = await fetch('/api/admin/n8n-config?type=icp');
      if (response.ok) {
        const data = await response.json();
        if (data.data && data.data.length > 0) {
          const icpConfig = data.data[0];
          setConfig(icpConfig);
          setFormData({
            webhook_url: icpConfig.webhook_url || '',
            auth_username: icpConfig.auth_username || '',
            auth_password: icpConfig.auth_password || '',
          });
        }
      }
    } catch (error) {
      console.error('Error fetching config:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const response = await fetch('/api/admin/n8n-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhook_type: 'icp',
          webhook_url: formData.webhook_url,
          auth_type: 'basic',
          auth_username: formData.auth_username,
          auth_password: formData.auth_password,
        }),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.message);

      toast.success('Webhook configurado com sucesso!');
      fetchConfig();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao salvar configuração');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold">Configuração N8N</h1>
        <p className="text-muted-foreground mt-1">
          Configure os webhooks e credenciais do n8n para extração de leads
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Webhook className="h-5 w-5 text-primary" />
            <CardTitle>Webhook ICP - VendAgro</CardTitle>
          </div>
          <CardDescription>
            Configure a URL e credenciais de autenticação para o webhook de extração de leads ICP
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="webhook_url">URL do Webhook</Label>
            <Input
              id="webhook_url"
              type="url"
              placeholder="https://vendai-n8n.aw5nou.easypanel.host/webhook/..."
              value={formData.webhook_url}
              onChange={(e) => setFormData({ ...formData, webhook_url: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              URL completa do webhook n8n para extração de leads ICP
            </p>
          </div>

          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold mb-3">Autenticação Basic Auth</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="auth_username">Username</Label>
                <Input
                  id="auth_username"
                  placeholder="Username"
                  value={formData.auth_username}
                  onChange={(e) => setFormData({ ...formData, auth_username: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="auth_password">Password</Label>
                <Input
                  id="auth_password"
                  type="password"
                  placeholder="Password"
                  value={formData.auth_password}
                  onChange={(e) => setFormData({ ...formData, auth_password: e.target.value })}
                />
              </div>
            </div>
          </div>

          {config && (
            <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-3 flex items-center gap-2">
              <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
              <p className="text-sm text-green-700 dark:text-green-300">
                Webhook configurado e ativo
              </p>
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar Configuração'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
