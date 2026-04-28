export const dynamic = 'force-dynamic';

'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/use-toast';
import { ArrowLeft, Loader2, Power, Trash2, Calendar, Target, X, Camera, Bot } from 'lucide-react';
import { Company } from '@/types/database.types';
import { usePhoneMask } from '@/lib/hooks/usePhoneMask';
import { BriefingCompanyConfig } from '@/components/admin/BriefingCompanyConfig';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export default function EmpresaDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { applyPhoneMask, removeMask } = usePhoneMask();

  // SDR config state
  const [sdrConfig, setSdrConfig] = useState({
    uazapi_instance_url: '',
    uazapi_instance_name: '',
    uazapi_token: '',
    openai_key: '',
    has_token: false,
    has_openai: false,
    instance_status: 'disconnected' as string,
    instance_phone: null as string | null,
  });
  const [savingSdr, setSavingSdr] = useState(false);
  const [sdrStatus, setSdrStatus] = useState<{ status: string; phone: string | null; qrcode: string | null; pairingCode: string | null } | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);

  useEffect(() => {
    fetchCompany();
    fetchSdrConfig();
  }, [params.id]);

  async function fetchSdrConfig() {
    try {
      const res = await fetch(`/api/admin/sdr/${params.id}`);
      const data = await res.json();
      if (data.config) {
        setSdrConfig({
          uazapi_instance_url: data.config.uazapi_instance_url || '',
          uazapi_instance_name: data.config.uazapi_instance_name || '',
          uazapi_token: '',
          openai_key: '',
          has_token: data.config.has_token,
          has_openai: data.config.has_openai,
          instance_status: data.config.instance_status || 'disconnected',
          instance_phone: data.config.instance_phone,
        });
      }
    } catch {}
  }

  async function handleSaveSdr() {
    setSavingSdr(true);
    try {
      const body: Record<string, string> = {
        uazapi_instance_url: sdrConfig.uazapi_instance_url,
        uazapi_instance_name: sdrConfig.uazapi_instance_name,
      };
      if (sdrConfig.uazapi_token) body.uazapi_token = sdrConfig.uazapi_token;
      if (sdrConfig.openai_key) body.openai_key = sdrConfig.openai_key;

      const res = await fetch(`/api/admin/sdr/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast({ title: 'Credenciais SDR salvas!' });
      setSdrConfig((p) => ({ ...p, uazapi_token: '', openai_key: '', has_token: !!p.uazapi_token || p.has_token, has_openai: !!p.openai_key || p.has_openai }));
    } catch (err: any) {
      toast({ title: err.message || 'Erro ao salvar', variant: 'destructive' });
    } finally {
      setSavingSdr(false);
    }
  }

  async function handleCheckStatus() {
    if (!sdrConfig.uazapi_instance_url || !sdrConfig.has_token) {
      toast({ title: 'Configure e salve a URL e token antes de verificar o status', variant: 'destructive' });
      return;
    }
    setCheckingStatus(true);
    try {
      // Usa o endpoint de status da empresa (via service route)
      const res = await fetch(`/api/admin/sdr/${params.id}/status`);
      const data = await res.json();
      setSdrStatus(data);
    } catch (err: any) {
      toast({ title: 'Erro ao verificar status', variant: 'destructive' });
    } finally {
      setCheckingStatus(false);
    }
  }

  async function handleDisconnectSdr() {
    try {
      const res = await fetch(`/api/admin/sdr/${params.id}/disconnect`, { method: 'POST' });
      if (!res.ok) throw new Error((await res.json()).error);
      setSdrStatus(null);
      setSdrConfig((p) => ({ ...p, instance_status: 'disconnected', instance_phone: null }));
      toast({ title: 'WhatsApp desconectado' });
    } catch (err: any) {
      toast({ title: err.message || 'Erro ao desconectar', variant: 'destructive' });
    }
  }

  async function fetchCompany() {
    try {
      const response = await fetch(`/api/admin/companies/${params.id}`);
      const data = await response.json();

      if (!response.ok) throw new Error(data.message);

      setCompany(data.data);
    } catch (error: any) {
      toast({ title: 'Erro ao carregar empresa', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!company) return;

    setSaving(true);
    try {
      console.log('🔍 [Admin] Salvando empresa:', {
        plan_type: company.plan_type,
        plan_name: company.plan_name,
        plan_price: company.plan_price,
        fullCompany: company
      });

      const response = await fetch(`/api/admin/companies/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(company),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.message);

      console.log('✅ [Admin] Resposta do servidor:', data.data);

      toast({
        title: 'Empresa atualizada!',
        description: 'As alterações foram salvas com sucesso.',
      });
      setCompany(data.data);
    } catch (error: any) {
      console.error('❌ [Admin] Erro ao salvar:', error);
      toast({
        title: 'Erro ao atualizar empresa',
        description: error.message || 'Ocorreu um erro ao salvar as alterações',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStatus() {
    if (!company) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/admin/companies/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...company, is_active: !company.is_active }),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.message);

      toast({
        title: `Empresa ${!company.is_active ? 'ativada' : 'desativada'}!`,
        description: 'O status foi alterado com sucesso.',
      });
      setCompany(data.data);
    } catch (error: any) {
      toast({ title: 'Erro ao alterar status', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!company) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/admin/companies/${params.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.message);

      toast({ title: 'Empresa deletada!', description: 'A empresa foi removida com sucesso.' });
      router.push('/admin/empresas');
    } catch (error: any) {
      toast({ title: 'Erro ao deletar empresa', description: error.message, variant: 'destructive' });
      setSaving(false);
    }
  }

  async function handleImageUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !company) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('companyId', company.id.toString());

      const response = await fetch('/api/company/upload-logo', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setCompany({ ...company, image_url: data.logoUrl });
        toast({ title: 'Logo carregado!', description: 'A imagem foi enviada com sucesso.' });
      } else {
        toast({ title: 'Erro ao fazer upload', description: data.message, variant: 'destructive' });
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({ title: 'Erro ao fazer upload', description: 'Não foi possível enviar a imagem', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  }

  function handleRemoveImage() {
    if (!company) return;
    setCompany({ ...company, image_url: '' });
  }

  if (loading || !company) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-shimmer h-8 w-32 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{company.name}</h1>
            <p className="text-muted-foreground mt-1">Detalhes e configurações</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar Alterações'
            )}
          </Button>
          <Button
            variant={company.is_active ? 'outline' : 'default'}
            onClick={handleToggleStatus}
            disabled={saving}
          >
            <Power className="mr-2 h-4 w-4" />
            {company.is_active ? 'Desativar' : 'Ativar'}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={saving}>
                <Trash2 className="mr-2 h-4 w-4" />
                Deletar
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação não pode ser desfeita. Isso irá deletar permanentemente a
                  empresa <strong>{company.name}</strong> e todos os seus dados
                  associados.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Deletar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Informações Gerais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                value={company.name}
                onChange={(e) => setCompany({ ...company, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={company.email}
                onChange={(e) => setCompany({ ...company, email: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                value={applyPhoneMask(company.phone || '')}
                onChange={(e) => {
                  const unmasked = removeMask(e.target.value);
                  setCompany({ ...company, phone: unmasked });
                }}
                placeholder="(00) 00000-0000"
                maxLength={15}
              />
              <p className="text-xs text-muted-foreground">
                Detecta automaticamente fixo ou móvel
              </p>
            </div>

            <div className="space-y-2">
              <Label>Logo da Empresa</Label>
              <div className="flex items-center gap-4">
                {company.image_url ? (
                  <div className="relative">
                    <img
                      src={company.image_url}
                      alt="Logo da empresa"
                      className="w-20 h-20 rounded-full object-cover border-2 border-border"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                      onClick={handleRemoveImage}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center border-2 border-dashed border-border">
                    <Camera className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="gap-2"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Camera className="h-4 w-4" />
                        {company.image_url ? 'Alterar Logo' : 'Fazer Upload'}
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground mt-1">
                    JPG, PNG, WEBP ou GIF (máx. 2MB)
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <div className="flex items-center gap-2">
                {company.is_active ? (
                  <Badge className="bg-primary">Ativa</Badge>
                ) : (
                  <Badge variant="destructive">Inativa</Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Planos e Limites</CardTitle>
                <CardDescription>Configure o plano e acompanhe MQLs</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="plan_type">Plano</Label>
              <Select
                value={company.plan_type || 'basic'}
                onValueChange={(value: any) => {
                  const planPriceMap: Record<string, number> = {
                    'basic': 0,
                    'starter': 397,
                    'pro': 597,
                    'scale': 997,
                  };
                  setCompany({
                    ...company,
                    plan_type: value,
                    plan_price: planPriceMap[value] ?? 0,
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="basic">
                    <div className="flex flex-col">
                      <span className="font-medium">Basic (Gratuito)</span>
                      <span className="text-xs text-muted-foreground">Sem assinatura ativa</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="starter">
                    <div className="flex flex-col">
                      <span className="font-medium">Starter</span>
                      <span className="text-xs text-muted-foreground">R$ 397/mês — 1 número, 5M tokens</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="pro">
                    <div className="flex flex-col">
                      <span className="font-medium">Pro</span>
                      <span className="text-xs text-muted-foreground">R$ 597/mês — 3 números, 15M tokens</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="scale">
                    <div className="flex flex-col">
                      <span className="font-medium">Scale</span>
                      <span className="text-xs text-muted-foreground">R$ 997/mês — 10 números, 50M tokens</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Assinatura</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="subscription_expires_at">Data de Vencimento</Label>
              <div className="flex gap-2">
                <Input
                  id="subscription_expires_at"
                  type="date"
                  value={
                    company.subscription_expires_at
                      ? new Date(company.subscription_expires_at).toISOString().split('T')[0]
                      : ''
                  }
                  onChange={(e) =>
                    setCompany({ ...company, subscription_expires_at: e.target.value })
                  }
                />
                <Button
                  variant="outline"
                  onClick={() => {
                    const nextMonth = new Date();
                    nextMonth.setMonth(nextMonth.getMonth() + 1);
                    setCompany({
                      ...company,
                      subscription_expires_at: nextMonth.toISOString(),
                    });
                  }}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  +30d
                </Button>
              </div>
              {company.subscription_expires_at && (
                <p className="text-xs text-muted-foreground">
                  {new Date(company.subscription_expires_at) < new Date() ? (
                    <span className="text-red-500 font-semibold">
                      ⚠️ Vencida há{' '}
                      {Math.floor(
                        (new Date().getTime() -
                          new Date(company.subscription_expires_at).getTime()) /
                          (1000 * 60 * 60 * 24)
                      )}{' '}
                      dias
                    </span>
                  ) : (
                    <span className="text-primary">
                      ✓ Vence em{' '}
                      {Math.floor(
                        (new Date(company.subscription_expires_at).getTime() -
                          new Date().getTime()) /
                          (1000 * 60 * 60 * 24)
                      )}{' '}
                      dias
                    </span>
                  )}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>WhatsApp (UAZap)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="whatsapp_instance">URL da Instância</Label>
                <Input
                  id="whatsapp_instance"
                  value={company.whatsapp_instance || ''}
                  onChange={(e) =>
                    setCompany({ ...company, whatsapp_instance: e.target.value })
                  }
                  placeholder="https://empresa.uazapi.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="whatsapp_token">Token</Label>
                <Input
                  id="whatsapp_token"
                  type="password"
                  value={company.whatsapp_token || ''}
                  onChange={(e) => setCompany({ ...company, whatsapp_token: e.target.value })}
                  placeholder="Token de acesso"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Webhooks N8N</CardTitle>
          <CardDescription>Automações exclusivas desta empresa</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Webhook Maps */}
          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Extração de Leads (Maps)</p>
                <p className="text-xs text-muted-foreground">Usado na captura de leads via Google Maps</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={company.webhook_maps_enabled ? 'default' : 'secondary'}>
                  {company.webhook_maps_enabled ? 'Ativo' : 'Inativo'}
                </Badge>
                <Switch
                  checked={!!company.webhook_maps_enabled}
                  onCheckedChange={(v) => setCompany({ ...company, webhook_maps_enabled: v })}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="webhook_maps_url" className="text-xs">URL do Webhook</Label>
              <Input
                id="webhook_maps_url"
                value={company.webhook_maps_url || ''}
                onChange={(e) => setCompany({ ...company, webhook_maps_url: e.target.value })}
                placeholder="https://n8n.empresa.com/webhook/extrair-leads"
              />
            </div>
          </div>

          {/* Webhook WhatsApp */}
          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Envio de Mensagens (WhatsApp)</p>
                <p className="text-xs text-muted-foreground">Usado no envio manual de mensagens via WhatsApp</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={company.webhook_whatsapp_enabled ? 'default' : 'secondary'}>
                  {company.webhook_whatsapp_enabled ? 'Ativo' : 'Inativo'}
                </Badge>
                <Switch
                  checked={!!company.webhook_whatsapp_enabled}
                  onCheckedChange={(v) => setCompany({ ...company, webhook_whatsapp_enabled: v })}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="webhook_whatsapp_url" className="text-xs">URL do Webhook</Label>
              <Input
                id="webhook_whatsapp_url"
                value={company.webhook_whatsapp_url || ''}
                onChange={(e) => setCompany({ ...company, webhook_whatsapp_url: e.target.value })}
                placeholder="https://n8n.empresa.com/webhook/send-manual-message"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SDR — Credenciais uazapi por empresa */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="w-4 h-4" />
            Agente SDR — Credenciais uazapi
          </CardTitle>
          <CardDescription>
            Configure a instância uazapi desta empresa. O cliente não vê estas informações.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>URL da instância</Label>
              <Input
                value={sdrConfig.uazapi_instance_url}
                onChange={(e) => setSdrConfig({ ...sdrConfig, uazapi_instance_url: e.target.value })}
                placeholder="https://nexioai.uazapi.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Nome da instância</Label>
              <Input
                value={sdrConfig.uazapi_instance_name}
                onChange={(e) => setSdrConfig({ ...sdrConfig, uazapi_instance_name: e.target.value })}
                placeholder="empresa-4"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Token da instância</Label>
            <Input
              type="password"
              value={sdrConfig.uazapi_token}
              onChange={(e) => setSdrConfig({ ...sdrConfig, uazapi_token: e.target.value })}
              placeholder={sdrConfig.has_token ? 'Token já salvo — cole para alterar' : 'Token da instância uazapi'}
            />
            {sdrConfig.has_token && !sdrConfig.uazapi_token && (
              <p className="text-xs text-green-600">✓ Token configurado</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>OpenAI API Key (opcional — usa global se vazio)</Label>
            <Input
              type="password"
              value={sdrConfig.openai_key}
              onChange={(e) => setSdrConfig({ ...sdrConfig, openai_key: e.target.value })}
              placeholder={sdrConfig.has_openai ? 'Chave já salva — cole para alterar' : 'sk-…'}
            />
          </div>

          {/* Status atual */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border">
            <div className="flex-1">
              <p className="text-sm font-medium">Status da instância</p>
              <p className="text-xs text-muted-foreground">
                {sdrStatus ? (
                  sdrStatus.status === 'connected'
                    ? `✅ Conectado${sdrStatus.phone ? ` — ${sdrStatus.phone}` : ''}`
                    : sdrStatus.status === 'connecting'
                    ? '🟡 Conectando…'
                    : '🔴 Desconectado'
                ) : (
                  sdrConfig.instance_status === 'connected'
                    ? `✅ Conectado${sdrConfig.instance_phone ? ` — ${sdrConfig.instance_phone}` : ''}`
                    : '🔴 Desconectado'
                )}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={handleCheckStatus} disabled={checkingStatus}>
              {checkingStatus ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Verificar status
            </Button>
            {(sdrStatus?.status === 'connected' || sdrConfig.instance_status === 'connected') && (
              <Button variant="destructive" size="sm" onClick={handleDisconnectSdr}>
                Desconectar
              </Button>
            )}
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSaveSdr} disabled={savingSdr}>
              {savingSdr && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Salvar credenciais
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Briefing multi-tenant */}
      {company && (
        <BriefingCompanyConfig
          companyId={company.id}
          companyName={company.name}
        />
      )}
    </div>
  );
}
