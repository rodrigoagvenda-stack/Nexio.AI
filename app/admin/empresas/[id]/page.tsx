'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import {
  ArrowLeft, Loader2, Power, Trash2, Calendar,
  Camera, Bot, Wifi, WifiOff, RefreshCw, ChevronDown,
} from 'lucide-react';
import { Company } from '@/types/database.types';
import { usePhoneMask } from '@/lib/hooks/usePhoneMask';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// ── Plan config ───────────────────────────────────────────────────────────────

const PLANS: Record<string, { label: string; price: number; color: string }> = {
  trial:   { label: 'Trial',          price: 0,   color: 'text-yellow-400' },
  basic:   { label: 'Free',           price: 0,   color: 'text-muted-foreground' },
  starter: { label: 'Zaapply Start',  price: 397, color: 'text-blue-400' },
  pro:     { label: 'Zaapply Growth', price: 697, color: 'text-primary' },
  scale:   { label: 'Zaapply Pro',    price: 997, color: 'text-orange-400' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysFromNow(iso: string): number {
  return Math.floor((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

function InstanceDot({ status }: { status: string }) {
  return (
    <span className={cn('inline-block w-2 h-2 rounded-full flex-shrink-0', {
      'bg-emerald-500': status === 'connected',
      'bg-yellow-400 animate-pulse': status === 'connecting',
      'bg-muted-foreground/40': status === 'disconnected',
    })} />
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function EmpresaDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { applyPhoneMask, removeMask } = usePhoneMask();

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
  const [sdrStatus, setSdrStatus] = useState<{ status: string; phone: string | null } | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

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
      toast({ title: 'Credenciais SDR salvas' });
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
      const res = await fetch(`/api/admin/sdr/${params.id}/status`);
      const data = await res.json();
      setSdrStatus(data);
    } catch {
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
      const res = await fetch(`/api/admin/companies/${params.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setCompany(data.data);
    } catch (err: any) {
      toast({ title: 'Erro ao carregar empresa', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!company) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/companies/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(company),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast({ title: 'Empresa atualizada' });
      setCompany(data.data);
    } catch (err: any) {
      toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStatus() {
    if (!company) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/companies/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...company, is_active: !company.is_active }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast({ title: `Empresa ${!company.is_active ? 'ativada' : 'desativada'}` });
      setCompany(data.data);
    } catch (err: any) {
      toast({ title: 'Erro ao alterar status', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!company) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/companies/${params.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast({ title: 'Empresa deletada' });
      router.push('/admin/empresas');
    } catch (err: any) {
      toast({ title: 'Erro ao deletar', description: err.message, variant: 'destructive' });
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
      const res = await fetch('/api/company/upload-logo', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success) {
        setCompany({ ...company, image_url: data.logoUrl });
        toast({ title: 'Logo atualizado' });
      } else {
        toast({ title: 'Erro no upload', description: data.message, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Erro no upload', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  }

  // ── Loading ─────────────────────────────────────────────────────────────────

  if (loading || !company) {
    return (
      <div className="space-y-5 max-w-5xl">
        <div className="h-8 w-48 bg-muted/60 rounded animate-pulse" />
        <div className="grid grid-cols-3 gap-5">
          <div className="col-span-2 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 bg-muted/40 rounded-lg animate-pulse" />
            ))}
          </div>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 bg-muted/40 rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const instanceStatus = sdrStatus?.status ?? sdrConfig.instance_status;
  const instancePhone  = sdrStatus?.phone  ?? sdrConfig.instance_phone;
  const isConnected    = instanceStatus === 'connected';
  const plan           = PLANS[company.plan_type ?? 'basic'] ?? PLANS.basic;
  const subDays        = company.subscription_expires_at ? daysFromNow(company.subscription_expires_at) : null;

  return (
    <div className="max-w-5xl space-y-6">

      {/* ── Header ────────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => router.back()}
            className="p-1.5 rounded-lg hover:bg-accent transition-colors flex-shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-semibold tracking-tight truncate">{company.name}</h1>
              <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full bg-muted/60', plan.color)}>
                {plan.label}
              </span>
              <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full', company.is_active
                ? 'bg-emerald-500/10 text-emerald-500'
                : 'bg-muted text-muted-foreground'
              )}>
                {company.is_active ? 'Ativa' : 'Inativa'}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">{company.email}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <Button onClick={handleSave} disabled={saving} size="sm" className="h-8 px-4">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
            Salvar
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={handleToggleStatus} disabled={saving}>
                <Power className="h-4 w-4 mr-2" />
                {company.is_active ? 'Desativar empresa' : 'Ativar empresa'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Deletar empresa
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Deletar {company.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação é permanente e remove todos os dados associados à empresa.
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

      {/* ── Body ────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

        {/* ── Esquerda (3/5) ─────────────────────────────────────────────────── */}
        <div className="lg:col-span-3 space-y-5">

          {/* Informações */}
          <div className="border border-border/50 rounded-xl bg-card p-5 space-y-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Informações</p>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Nome</Label>
                <Input
                  value={company.name}
                  onChange={(e) => setCompany({ ...company, name: e.target.value })}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Email</Label>
                <Input
                  type="email"
                  value={company.email}
                  onChange={(e) => setCompany({ ...company, email: e.target.value })}
                  className="h-9"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Telefone</Label>
                <Input
                  value={applyPhoneMask(company.phone || '')}
                  onChange={(e) => setCompany({ ...company, phone: removeMask(e.target.value) })}
                  placeholder="(00) 00000-0000"
                  maxLength={15}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Logo</Label>
                <div className="flex items-center gap-3">
                  {company.image_url ? (
                    <div className="relative flex-shrink-0">
                      <img src={company.image_url} alt="Logo" className="w-9 h-9 rounded-lg object-cover border border-border" />
                      <button
                        onClick={() => setCompany({ ...company, image_url: '' })}
                        className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-[9px] font-bold"
                      >×</button>
                    </div>
                  ) : (
                    <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center border border-dashed border-border flex-shrink-0">
                      <Camera className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <div>
                    <input ref={fileInputRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp,image/gif" className="hidden" onChange={handleImageUpload} />
                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                      {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
                      {company.image_url ? 'Alterar' : 'Upload'}
                    </Button>
                    <p className="text-[10px] text-muted-foreground mt-0.5">JPG, PNG, WEBP · 2MB</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Agente SDR */}
          <div className="border border-border/50 rounded-xl bg-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Agente SDR</p>
              </div>
              <div className="flex items-center gap-1.5">
                <InstanceDot status={instanceStatus} />
                <span className="text-xs text-muted-foreground">
                  {instanceStatus === 'connected'
                    ? `Conectado${instancePhone ? ` · ${instancePhone}` : ''}`
                    : instanceStatus === 'connecting' ? 'Conectando…' : 'Desconectado'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">URL da instância</Label>
                <Input value={sdrConfig.uazapi_instance_url} onChange={(e) => setSdrConfig({ ...sdrConfig, uazapi_instance_url: e.target.value })} placeholder="https://nexioai.uazapi.com" className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Nome da instância</Label>
                <Input value={sdrConfig.uazapi_instance_name} onChange={(e) => setSdrConfig({ ...sdrConfig, uazapi_instance_name: e.target.value })} placeholder="empresa-4" className="h-9" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Token uazapi</Label>
                <Input
                  type="password"
                  value={sdrConfig.uazapi_token}
                  onChange={(e) => setSdrConfig({ ...sdrConfig, uazapi_token: e.target.value })}
                  placeholder={sdrConfig.has_token ? 'Configurado. Cole para alterar' : 'Token da instância'}
                  className="h-9"
                />
                {sdrConfig.has_token && !sdrConfig.uazapi_token && (
                  <p className="text-[10px] text-emerald-500 flex items-center gap-1">✓ Token configurado</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">OpenAI Key <span className="font-normal opacity-60">(opcional)</span></Label>
                <Input
                  type="password"
                  value={sdrConfig.openai_key}
                  onChange={(e) => setSdrConfig({ ...sdrConfig, openai_key: e.target.value })}
                  placeholder={sdrConfig.has_openai ? 'Configurada. Cole para alterar' : 'sk-… (usa global se vazio)'}
                  className="h-9"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-0.5">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={handleCheckStatus} disabled={checkingStatus}>
                  {checkingStatus ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Wifi className="h-3.5 w-3.5" />}
                  Verificar status
                </Button>
                {isConnected && (
                  <Button variant="outline" size="sm" className="h-8 gap-1.5 text-destructive hover:text-destructive" onClick={handleDisconnectSdr}>
                    <WifiOff className="h-3.5 w-3.5" />
                    Desconectar
                  </Button>
                )}
              </div>
              <Button size="sm" className="h-8" onClick={handleSaveSdr} disabled={savingSdr}>
                {savingSdr && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                Salvar credenciais
              </Button>
            </div>
          </div>
        </div>

        {/* ── Direita (2/5) ──────────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Plano + Assinatura + Features : tudo em um card */}
          <div className="border border-border/50 rounded-xl bg-card divide-y divide-border/50">

            {/* Plano */}
            <div className="p-5 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Plano</p>
              <Select
                value={company.plan_type || 'basic'}
                onValueChange={(value) => {
                  setCompany({ ...company, plan_type: value as Company['plan_type'], plan_price: PLANS[value]?.price ?? 0 });
                }}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PLANS).map(([key, p]) => (
                    <SelectItem key={key} value={key}>
                      <span className={p.color}>{p.label}</span>
                      {p.price > 0 && <span className="text-muted-foreground ml-1.5 text-xs">R$ {p.price.toLocaleString('pt-BR')}</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Assinatura */}
            <div className="p-5 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Assinatura</p>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Vencimento</Label>
                <Input
                  type="date"
                  value={company.subscription_expires_at ? new Date(company.subscription_expires_at).toISOString().split('T')[0] : ''}
                  onChange={(e) => setCompany({ ...company, subscription_expires_at: e.target.value })}
                  className="h-9"
                />
                <div className="flex gap-2 pt-0.5">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 flex-1 text-xs gap-1 text-yellow-400 border-yellow-400/30 hover:bg-yellow-400/10"
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() + 7);
                      setCompany({ ...company, plan_type: 'trial' as any, plan_price: 0, subscription_expires_at: d.toISOString() });
                    }}
                  >
                    <Calendar className="h-3 w-3" />+7d Trial
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 flex-1 text-xs gap-1"
                    onClick={() => {
                      const d = new Date();
                      d.setMonth(d.getMonth() + 1);
                      setCompany({ ...company, subscription_expires_at: d.toISOString() });
                    }}
                  >
                    <Calendar className="h-3 w-3" />+30d
                  </Button>
                </div>
                {subDays !== null && (
                  <p className={cn('text-[11px] font-medium', subDays < 0 ? 'text-destructive' : 'text-emerald-500')}>
                    {subDays < 0 ? `Vencida há ${Math.abs(subDays)} dias` : `Vence em ${subDays} dias`}
                  </p>
                )}
                {company.subscription_start_date && (
                  <p className="text-[10px] text-muted-foreground">
                    Início: {new Date(company.subscription_start_date).toLocaleDateString('pt-BR')}
                  </p>
                )}
              </div>
            </div>

            {/* Features */}
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Trial SaaS</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Habilita módulo de trial para esta empresa</p>
                </div>
                <Switch
                  checked={company.trial_enabled ?? false}
                  onCheckedChange={(v) => setCompany({ ...company, trial_enabled: v })}
                />
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-border/40">
                <div>
                  <p className="text-sm font-medium">API Não Oficial (uazapi)</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Permite usar uazapi em vez da Meta Cloud API</p>
                </div>
                <Switch
                  checked={company.allow_uazapi ?? true}
                  onCheckedChange={(v) => setCompany({ ...company, allow_uazapi: v })}
                />
              </div>
            </div>

            {/* Feature flags */}
            <div className="p-5 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Feature Flags</p>
              {([
                { key: 'canvas',      label: 'Canvas de Automação',    desc: 'Editor visual de fluxos de automação' },
                { key: 'agenda',      label: 'Agenda',                 desc: 'Módulo de agendamento' },
                { key: 'metricas',    label: 'Métricas',               desc: 'Relatórios e análises avançadas' },
                { key: 'financeiro',  label: 'Financeiro',             desc: 'Gestão financeira e cobranças' },
                { key: 'meta_ads',    label: 'Meta Ads',               desc: 'Atribuição de campanhas via WhatsApp' },
                { key: 'anti_noshow', label: 'Anti Noshow',            desc: 'Motor de reconfirmação automática' },
                { key: 'remarketing', label: 'Remarketing',            desc: 'Reativação de leads perdidos' },
                { key: 'follow_up',   label: 'Follow-up',             desc: 'Sequências automáticas de follow-up' },
                { key: 'outbound',    label: 'Outbound (disparo frio)', desc: 'Prospecção ativa via WhatsApp, com limites e anti-ban' },
              ] as { key: string; label: string; desc: string }[]).map(({ key, label, desc }) => (
                <div key={key} className="flex items-center justify-between py-1.5">
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{desc}</p>
                  </div>
                  <Switch
                    checked={!!(company.features?.[key])}
                    onCheckedChange={(v) =>
                      setCompany({ ...company, features: { ...(company.features ?? {}), [key]: v } })
                    }
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Asaas : cobrança */}
          <div className="border border-border/50 rounded-xl bg-card p-5 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cobrança (Asaas)</p>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Customer ID</Label>
              <Input
                value={company.asaas_customer_id ?? ''}
                onChange={(e) => setCompany({ ...company, asaas_customer_id: e.target.value || null })}
                placeholder="cus_…"
                className="h-9 font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">CPF / CNPJ</Label>
              <Input
                value={company.asaas_cpf_cnpj ?? ''}
                onChange={(e) => setCompany({ ...company, asaas_cpf_cnpj: e.target.value || null })}
                placeholder="00.000.000/0001-00"
                className="h-9 font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Subscription ID</Label>
              <Input
                value={company.asaas_subscription_id ?? ''}
                onChange={(e) => setCompany({ ...company, asaas_subscription_id: e.target.value || null })}
                placeholder="sub_…"
                className="h-9 font-mono text-xs"
              />
              {company.asaas_subscription_id && (
                <p className="text-[10px] text-emerald-500">✓ Assinatura recorrente ativa</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
