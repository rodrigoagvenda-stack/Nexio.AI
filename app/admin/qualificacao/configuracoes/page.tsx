'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/use-toast';
import { ArrowLeft, Save, Loader2, Zap, CheckCircle2, XCircle } from 'lucide-react';
import { LeadQualificationConfig } from '@/types/lead-qualification';
import { formatDateTime } from '@/lib/utils/format';

export default function LeadQualificationConfigPage() {
  const [config, setConfig] = useState<LeadQualificationConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  async function fetchConfig() {
    try {
      const response = await fetch('/api/lead-qualification/config');
      const data = await response.json();

      if (!response.ok) throw new Error(data.message);

      setConfig(data.data);
      setWebhookUrl(data.data?.webhook_url || '');
      setWebhookSecret(data.data?.webhook_secret || '');
      setIsActive(data.data?.is_active || false);
    } catch (error: any) {
      console.error('Error fetching config:', error);
      toast({ title: error.message || 'Erro ao carregar configuração', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const response = await fetch('/api/lead-qualification/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhook_url: webhookUrl,
          webhook_secret: webhookSecret,
          is_active: isActive,
        }),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.message);

      setConfig(data.data);
      toast({ title: 'Configuração salva com sucesso!' });
    } catch (error: any) {
      toast({ title: error.message || 'Erro ao salvar configuração', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    if (!webhookUrl) {
      toast({ title: 'Configure a URL do webhook primeiro', variant: 'destructive' });
      return;
    }

    setTesting(true);
    try {
      const response = await fetch('/api/lead-qualification/config/test', {
        method: 'POST',
      });

      const data = await response.json();

      if (data.success) {
        toast({ title: 'Webhook testado com sucesso!' });
      } else {
        toast({ title: data.message || 'Falha no teste do webhook', variant: 'destructive' });
      }

      // Recarregar config para atualizar status do teste
      await fetchConfig();
    } catch (error: any) {
      toast({ title: error.message || 'Erro ao testar webhook', variant: 'destructive' });
    } finally {
      setTesting(false);
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
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/qualificacao">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Configurar Webhook</h1>
          <p className="text-muted-foreground mt-1">
            Configure o webhook para receber as respostas da qualificação de leads
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Webhook de Integração</CardTitle>
          <CardDescription>
            Configure uma URL para receber automaticamente os dados quando um novo lead preencher o formulário
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="webhook-url">URL do Webhook</Label>
            <Input
              id="webhook-url"
              type="url"
              placeholder="https://seu-webhook.com/endpoint"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Será enviado um POST com os dados do formulário para esta URL
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="webhook-secret">Secret (opcional)</Label>
            <Input
              id="webhook-secret"
              type="password"
              placeholder="Seu secret para validar as requisições"
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Será enviado no header <code className="bg-muted px-1 rounded">x-webhook-secret</code>
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="is-active">Webhook Ativo</Label>
              <p className="text-xs text-muted-foreground">
                Ative para enviar dados automaticamente
              </p>
            </div>
            <Switch
              id="is-active"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          </div>

          {config?.last_test_at && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
              {config.last_test_status === 'success' ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              <div>
                <p className="text-sm font-medium">
                  Último teste: {config.last_test_status === 'success' ? 'Sucesso' : 'Falhou'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(config.last_test_at)}
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button
              onClick={handleTest}
              variant="outline"
              disabled={testing || !webhookUrl}
              className="flex-1"
            >
              {testing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Testando...
                </>
              ) : (
                <>
                  <Zap className="mr-2 h-4 w-4" />
                  Testar Webhook
                </>
              )}
            </Button>
            <Button onClick={handleSave} disabled={saving} className="flex-1">
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Salvar Configuração
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Formato do Payload</CardTitle>
          <CardDescription>Exemplo do JSON enviado para o webhook</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs">
{`{
  "event": "lead_qualification_completed",
  "response_id": 123,
  "submitted_at": "2025-02-04T12:00:00.000Z",
  "nome_completo": "João Silva",
  "whatsapp": "11999999999",
  "email": "joao@empresa.com",
  "nome_empresa": "Empresa XYZ",
  "segmento_negocio": "Clínica",
  "volume_atendimentos": "50_100",
  "principal_gargalo": "demora_resposta",
  "dor_principal": "...",
  "processo_vendas": "sim_estruturado",
  "ticket_medio": "R$ 500",
  "pessoas_comercial": "3",
  "urgencia": "curto_prazo",
  "budget": "5000_8000"
}`}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
