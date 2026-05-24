'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/lib/hooks/useUser';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/use-toast';
import {
  User, Camera, CreditCard, Calendar,
  CheckCircle2, Loader2, ExternalLink, Zap, TrendingUp, Rocket,
  AlertCircle, Sparkles, X, Shield, Check, Bot, UserMinus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PlanoCards, type PlanKey } from '@/components/planos/PlanoCards';

interface CompanyFull {
  id: number;
  plan_type: string;
  plan_monthly_limit?: number;
  tokens_used?: number;
  tokens_limit?: number;
  is_active: boolean;
  subscription_expires_at?: string | null;
  asaas_subscription_id?: string | null;
  asaas_cpf_cnpj?: string | null;
}

interface GoogleStatus { connected: boolean; email: string | null }

const PLANS = {
  basic:   { name: 'Basic',          price: 0,   tokens: 0,          icon: Zap,        desc: 'Plano gratuito' },
  starter: { name: 'Zaapply Start',  price: 397, tokens: 5_000_000,  icon: TrendingUp, desc: 'SDR + atendimento + follow-up automático' },
  pro:     { name: 'Zaapply Growth', price: 697, tokens: 15_000_000, icon: Rocket,     desc: 'Anti-Noshow, Remarketing e Trial SaaS desbloqueados' },
  scale:   { name: 'Zaapply Pro',    price: 997, tokens: 50_000_000, icon: Sparkles,   desc: 'Escala total: 50M tokens, usuários ilimitados e até 5 números' },
} as const;


function fmtTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function resolvePlan(raw: string) {
  if (raw in PLANS) return raw as keyof typeof PLANS;
  return 'basic' as keyof typeof PLANS;
}

const TABS = ['perfil', 'plano', 'integracoes', 'automacao', 'seguranca'] as const;
type Tab = typeof TABS[number];

// ─── Automação Inteligente ────────────────────────────────────────────────────

const LS_KEY_OPTOUT = 'nexio_optout_automatico';
const LS_KEY_PAUSA = 'nexio_pausa_humana';

function AutomacaoContent() {
  const [optout, setOptout] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(LS_KEY_OPTOUT) === 'true';
  });
  const [pausaHumana, setPausaHumana] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(LS_KEY_PAUSA) === 'true';
  });

  function handleOptout(v: boolean) {
    setOptout(v);
    localStorage.setItem(LS_KEY_OPTOUT, String(v));
    toast({ title: v ? 'Opt-out automático ativado' : 'Opt-out automático desativado' });
  }

  function handlePausaHumana(v: boolean) {
    setPausaHumana(v);
    localStorage.setItem(LS_KEY_PAUSA, String(v));
    toast({ title: v ? 'Pausa por conversa humana ativada' : 'Pausa por conversa humana desativada' });
  }

  return (
    <div className="space-y-4">
      <div className="p-6 rounded-2xl border border-border bg-card space-y-5">
        <div className="flex items-center gap-2 mb-1">
          <Bot className="h-4 w-4 text-primary" />
          <h2 className="font-semibold text-sm">Automação Inteligente</h2>
        </div>
        <p className="text-xs text-muted-foreground -mt-3">
          Comportamentos automáticos do sistema de sequências
        </p>

        {/* Opt-out automático */}
        <div className="flex items-start justify-between gap-4 py-4 border-t border-border">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
              <UserMinus className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-sm">Opt-out automático</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Quando lead enviar &quot;pare&quot;, &quot;sair&quot; ou &quot;não quero&quot;, remove automaticamente de todas as sequências
              </p>
            </div>
          </div>
          <Switch
            checked={optout}
            onCheckedChange={handleOptout}
            className="mt-0.5 shrink-0"
          />
        </div>

        {/* Pausa por conversa humana */}
        <div className="flex items-start justify-between gap-4 py-4 border-t border-border">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-sm">Pausa por conversa humana</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Quando um agente assumir o chat, as automações pausam automaticamente para evitar mensagens duplicadas
              </p>
            </div>
          </div>
          <Switch
            checked={pausaHumana}
            onCheckedChange={handlePausaHumana}
            className="mt-0.5 shrink-0"
          />
        </div>
      </div>

      <div className="p-4 rounded-xl border border-dashed border-border/60 bg-muted/20 flex items-center gap-3">
        <span className="text-[11px] text-muted-foreground">
          Configurações salvas localmente. Em breve serão sincronizadas via API para todos os membros da equipe.
        </span>
      </div>
    </div>
  );
}

function ConfiguracoesContent() {
  const { user, authUser } = useUser();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>(searchParams.get('checkout') ? 'plano' : 'perfil');

  const [profileData, setProfileData] = useState({ name: '', email: '', description: '', department: '' });
  const [photoUrl, setPhotoUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [company, setCompany] = useState<CompanyFull | null>(null);
  const [loadingCompany, setLoadingCompany] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' });
  const [changingPassword, setChangingPassword] = useState(false);

  const [cpfCnpjPrompt, setCpfCnpjPrompt] = useState<string | null>(null); // null = closed; string = plan being purchased
  const [cpfCnpjInput, setCpfCnpjInput] = useState('');
  const [savingCpfCnpj, setSavingCpfCnpj] = useState(false);

  const [googleStatus, setGoogleStatus] = useState<GoogleStatus | null>(null);
  const [googleLoading, setGoogleLoading] = useState(true);
  const [disconnectingGoogle, setDisconnectingGoogle] = useState(false);

  // MFA state
  const [mfaFactor, setMfaFactor] = useState<{ id: string } | null>(null);
  const [mfaLoading, setMfaLoading] = useState(true);
  const [mfaEnrolling, setMfaEnrolling] = useState(false);
  const [mfaEnrollData, setMfaEnrollData] = useState<{ id: string; qr_code: string; secret: string } | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaVerifying, setMfaVerifying] = useState(false);
  const [mfaDisabling, setMfaDisabling] = useState(false);

  useEffect(() => {
    const r = searchParams.get('checkout');
    if (r === 'success') toast({ title: '🎉 Assinatura ativada!' });
    if (r === 'cancelled') toast({ title: 'Pagamento cancelado.', variant: 'destructive' });
  }, [searchParams]);

  useEffect(() => {
    if (!user) return;
    setProfileData({ name: user.name || '', email: user.email || '', description: user.description || '', department: user.department || '' });
    setPhotoUrl(user.photo_url || '');
  }, [user]);

  const fetchCompany = useCallback(async () => {
    if (!user?.company_id) return;
    const { data } = await createClient().from('companies')
      .select('id,plan_type,plan_monthly_limit,tokens_used,tokens_limit,is_active,subscription_expires_at,asaas_subscription_id,asaas_cpf_cnpj')
      .eq('id', user.company_id).single();
    if (data) setCompany(data as CompanyFull);
    setLoadingCompany(false);
  }, [user?.company_id]);

  useEffect(() => { fetchCompany(); }, [fetchCompany]);

  useEffect(() => {
    fetch('/api/google/status').then(r => r.ok ? r.json() : null).then(d => { if (d) setGoogleStatus(d); setGoogleLoading(false); }).catch(() => setGoogleLoading(false));
  }, []);

  useEffect(() => {
    createClient().auth.mfa.listFactors().then(({ data }) => {
      setMfaFactor(data?.totp?.[0] ?? null);
      setMfaLoading(false);
    });
  }, []);

  const handleMfaStart = async () => {
    setMfaEnrolling(true);
    try {
      const { data, error } = await createClient().auth.mfa.enroll({ factorType: 'totp' });
      if (error) throw error;
      setMfaEnrollData({ id: data.id, qr_code: data.totp.qr_code, secret: data.totp.secret });
    } catch (err: any) {
      toast({ title: err.message || 'Erro ao iniciar MFA', variant: 'destructive' });
    } finally {
      setMfaEnrolling(false);
    }
  };

  const handleMfaVerify = async () => {
    if (!mfaEnrollData || mfaCode.length < 6) return;
    setMfaVerifying(true);
    try {
      const supabase = createClient();
      const { data: challenge, error: cErr } = await supabase.auth.mfa.challenge({ factorId: mfaEnrollData.id });
      if (cErr) throw cErr;
      const { error: vErr } = await supabase.auth.mfa.verify({ factorId: mfaEnrollData.id, challengeId: challenge.id, code: mfaCode });
      if (vErr) throw vErr;
      setMfaFactor({ id: mfaEnrollData.id });
      setMfaEnrollData(null);
      setMfaCode('');
      toast({ title: 'MFA ativado com sucesso! Sua conta está protegida.' });
    } catch (err: any) {
      toast({ title: err.message || 'Código inválido', variant: 'destructive' });
      setMfaCode('');
    } finally {
      setMfaVerifying(false);
    }
  };

  const handleMfaDisable = async () => {
    if (!mfaFactor) return;
    setMfaDisabling(true);
    try {
      const { error } = await createClient().auth.mfa.unenroll({ factorId: mfaFactor.id });
      if (error) throw error;
      setMfaFactor(null);
      toast({ title: 'MFA desativado.' });
    } catch (err: any) {
      toast({ title: err.message || 'Erro ao desativar MFA', variant: 'destructive' });
    } finally {
      setMfaDisabling(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploadingPhoto(true);
    const formData = new FormData(); formData.append('file', file);
    try {
      const res = await fetch('/api/user/upload-photo', { method: 'POST', body: formData });
      const d = await res.json();
      if (d.success) { setPhotoUrl(d.photoUrl); toast({ title: 'Foto atualizada!' }); window.location.reload(); }
      else toast({ title: d.message || 'Erro no upload', variant: 'destructive' });
    } catch { toast({ title: 'Erro no upload', variant: 'destructive' }); }
    finally { setUploadingPhoto(false); }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const { error } = await createClient().from('users')
        .update({ name: profileData.name, description: profileData.description, department: profileData.department })
        .eq('auth_user_id', authUser?.id);
      if (error) throw error;
      toast({ title: 'Perfil salvo!' });
    } catch { toast({ title: 'Erro ao salvar', variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  const handleChangePassword = async () => {
    if (passwords.next !== passwords.confirm) {
      toast({ title: 'As senhas não conferem', variant: 'destructive' }); return;
    }
    if (passwords.next.length < 6) {
      toast({ title: 'A nova senha deve ter pelo menos 6 caracteres', variant: 'destructive' }); return;
    }
    setChangingPassword(true);
    try {
      const sb = createClient();
      const { error: signInError } = await sb.auth.signInWithPassword({
        email: profileData.email,
        password: passwords.current,
      });
      if (signInError) throw new Error('Senha atual incorreta');
      const { error } = await sb.auth.updateUser({ password: passwords.next });
      if (error) throw error;
      setPasswords({ current: '', next: '', confirm: '' });
      toast({ title: 'Senha alterada com sucesso!' });
    } catch (err: any) {
      toast({ title: err.message || 'Erro ao alterar senha', variant: 'destructive' });
    } finally {
      setChangingPassword(false);
    }
  };

  const doCheckout = async (plan: string, cpfCnpj?: string, extra = 0) => {
    setCheckoutLoading(plan);
    try {
      const doc = cpfCnpj || company?.asaas_cpf_cnpj || '';
      const res = await fetch('/api/asaas/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan, cpfCnpj: doc, extraNumbers: extra }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      if (d.url) {
        window.location.href = d.url;
      } else {
        toast({ title: d.message || 'Assinatura criada! Verifique seu email para o link de pagamento.' });
        setCheckoutLoading(null);
      }
    } catch (err: any) { toast({ title: err.message || 'Erro no checkout', variant: 'destructive' }); setCheckoutLoading(null); }
  };

  const [pendingExtra, setPendingExtra] = useState(0);

  const handleCheckout = (plan: string, extra = 0) => {
    if (!company?.asaas_cpf_cnpj) {
      setCpfCnpjPrompt(plan);
      setCpfCnpjInput('');
      setPendingExtra(extra);
      return;
    }
    doCheckout(plan, undefined, extra);
  };

  const handleCpfCnpjSubmit = async () => {
    const doc = cpfCnpjInput.replace(/\D/g, '');
    if (doc.length !== 11 && doc.length !== 14) {
      toast({ title: 'CPF (11 dígitos) ou CNPJ (14 dígitos) inválido', variant: 'destructive' });
      return;
    }
    setSavingCpfCnpj(true);
    try {
      const { error } = await createClient().from('companies').update({ asaas_cpf_cnpj: doc }).eq('id', company!.id);
      if (error) throw error;
      setCompany(prev => prev ? { ...prev, asaas_cpf_cnpj: doc } : prev);
      const pending = cpfCnpjPrompt;
      setCpfCnpjPrompt(null);
      if (pending === '_extra_tokens_') handleBuyExtraTokens();
      else doCheckout(pending!, doc, pendingExtra);
    } catch (err: any) {
      toast({ title: err.message || 'Erro ao salvar documento', variant: 'destructive' });
    } finally {
      setSavingCpfCnpj(false);
    }
  };

  const handleGoogleDisconnect = async () => {
    setDisconnectingGoogle(true);
    await fetch('/api/google/status', { method: 'DELETE' }).catch(() => {});
    setGoogleStatus({ connected: false, email: null });
    toast({ title: 'Google Calendar desconectado' });
    setDisconnectingGoogle(false);
  };

  const currentPlanKey = resolvePlan(company?.plan_type || 'basic');
  const currentPlan = PLANS[currentPlanKey];
  const tokensUsed = company?.tokens_used ?? 0;
  const tokensLimit = company?.tokens_limit ?? company?.plan_monthly_limit ?? 0;
  const tokensPct = tokensLimit > 0 ? Math.min((tokensUsed / tokensLimit) * 100, 100) : 0;

  const [extraTokensOpen, setExtraTokensOpen] = useState(false);
  const [extraTokensAmount, setExtraTokensAmount] = useState(20);
  const [buyingTokens, setBuyingTokens] = useState(false);

  const handleBuyExtraTokens = async () => {
    if (!company?.asaas_cpf_cnpj) { setCpfCnpjPrompt('_extra_tokens_'); setCpfCnpjInput(''); return; }
    setBuyingTokens(true);
    try {
      const res = await fetch('/api/asaas/extra-tokens', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: extraTokensAmount }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      if (d.url) window.location.href = d.url;
      else toast({ title: d.message || 'Pagamento criado! Verifique seu email.' });
    } catch (err: any) {
      toast({ title: err.message || 'Erro ao processar compra', variant: 'destructive' });
    } finally {
      setBuyingTokens(false);
    }
  };

  const TAB_LABELS: Record<Tab, string> = { perfil: 'Perfil', plano: 'Plano', integracoes: 'Integrações', automacao: 'Automação', seguranca: 'Segurança' };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground text-sm mt-1">Gerencie sua conta, plano e integrações</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium transition-colors relative',
              tab === t
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {TAB_LABELS[t]}
            {tab === t && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-primary rounded-full" />}
          </button>
        ))}
      </div>

      {/* ── PERFIL ─────────────────────────────────────────────── */}
      {tab === 'perfil' && (
        <div className="grid md:grid-cols-5 gap-6">
          {/* Avatar col */}
          <div className="md:col-span-2 flex flex-col items-center gap-4 p-6 rounded-2xl border border-border bg-card">
            <div className="relative group">
              <Avatar className="h-28 w-28 ring-4 ring-border">
                {photoUrl
                  ? <AvatarImage src={photoUrl} className="object-cover" />
                  : <AvatarFallback className="bg-primary/10 text-primary text-3xl font-semibold">
                      {user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                }
              </Avatar>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto}
                className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
              >
                {uploadingPhoto ? <Loader2 className="h-6 w-6 text-white animate-spin" /> : <Camera className="h-6 w-6 text-white" />}
              </button>
            </div>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp" onChange={handlePhotoUpload} className="hidden" />
            <div className="text-center">
              <p className="font-semibold">{user?.name || '—'}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
              {user?.department && <p className="text-xs text-muted-foreground mt-1">{user.department}</p>}
            </div>
            <p className="text-[11px] text-muted-foreground">JPG, PNG ou WEBP · máx 5MB</p>
          </div>

          {/* Form col */}
          <div className="md:col-span-3 space-y-5">
            <div className="p-6 rounded-2xl border border-border bg-card space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <User className="h-4 w-4 text-primary" />
                <h2 className="font-semibold text-sm">Informações pessoais</h2>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Nome</Label>
                <Input value={profileData.name} onChange={e => setProfileData(p => ({ ...p, name: e.target.value }))} className="h-10" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Email</Label>
                <Input value={profileData.email} disabled className="h-10 opacity-60" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Cargo</Label>
                <Input value={profileData.department} onChange={e => setProfileData(p => ({ ...p, department: e.target.value }))} placeholder="Ex: Gerente de Vendas" className="h-10" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Bio</Label>
                <Textarea value={profileData.description} onChange={e => setProfileData(p => ({ ...p, description: e.target.value }))} rows={3} className="resize-none" />
              </div>
              <Button onClick={handleSaveProfile} disabled={saving} className="w-full h-10">
                {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Salvando…</> : 'Salvar alterações'}
              </Button>
            </div>

            <div className="p-6 rounded-2xl border border-border bg-card space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <Shield className="h-4 w-4 text-primary" />
                <h2 className="font-semibold text-sm">Segurança</h2>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Senha atual</Label>
                <Input type="password" placeholder="••••••••" className="h-10" value={passwords.current} onChange={e => setPasswords(p => ({ ...p, current: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Nova senha</Label>
                <Input type="password" placeholder="••••••••" className="h-10" value={passwords.next} onChange={e => setPasswords(p => ({ ...p, next: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Confirmar nova senha</Label>
                <Input type="password" placeholder="••••••••" className="h-10" value={passwords.confirm} onChange={e => setPasswords(p => ({ ...p, confirm: e.target.value }))} onKeyDown={e => e.key === 'Enter' && handleChangePassword()} />
              </div>
              <Button onClick={handleChangePassword} disabled={changingPassword || !passwords.current || !passwords.next || !passwords.confirm} variant="outline" className="w-full h-10">
                {changingPassword ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Alterando…</> : 'Alterar senha'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── PLANO ──────────────────────────────────────────────── */}
      {tab === 'plano' && (
        <div className="space-y-6">
          {loadingCompany ? (
            <div className="flex items-center justify-center h-48"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <>
              {/* Plano atual */}
              <div className="p-6 rounded-2xl border border-border bg-card">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                      <currentPlan.icon className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-lg leading-none">{currentPlan.name}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {currentPlanKey === 'basic' ? 'Sem assinatura ativa' : `R$ ${currentPlan.price}/mês`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      'text-xs font-medium px-2.5 py-1 rounded-full',
                      company?.is_active
                        ? 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20'
                        : 'bg-red-500/10 text-red-400 ring-1 ring-red-500/20'
                    )}>
                      {company?.is_active ? '● Ativo' : '● Inativo'}
                    </span>
                    {company?.asaas_subscription_id && (
                      <a
                        href="https://wa.me/5511999999999?text=Olá,%20preciso%20gerenciar%20minha%20assinatura%20Nexio%20AI"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 h-8 px-3 rounded-md border border-border text-xs font-medium hover:bg-accent transition-colors"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Gerenciar
                      </a>
                    )}
                  </div>
                </div>

                {tokensLimit > 0 && (
                  <div className="mt-5 space-y-2">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Tokens usados este mês</span>
                      <span className={cn('font-medium', tokensPct > 90 ? 'text-red-400' : 'text-foreground')}>
                        {fmtTokens(tokensUsed)} / {fmtTokens(tokensLimit)}
                      </span>
                    </div>
                    <Progress value={tokensPct} className={cn('h-1.5', tokensPct > 90 ? '[&>div]:bg-red-500' : '')} />
                    {tokensPct > 90 && (
                      <p className="text-xs text-red-400 flex items-center gap-1.5"><AlertCircle className="h-3.5 w-3.5" />Quase no limite — considere fazer upgrade</p>
                    )}
                  </div>
                )}

                {company?.subscription_expires_at && currentPlanKey !== 'basic' && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Renova em {new Date(company.subscription_expires_at).toLocaleDateString('pt-BR')}
                  </p>
                )}

                {/* Extra tokens */}
                {tokensLimit > 0 && (
                  <div className="mt-4 pt-4 border-t border-border/60">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">Tokens extras</p>
                      <button onClick={() => setExtraTokensOpen(o => !o)} className="text-xs text-primary font-medium hover:underline">
                        {extraTokensOpen ? 'Fechar' : 'Comprar pacote'}
                      </button>
                    </div>
                    {extraTokensOpen && (
                      <div className="mt-3 space-y-3">
                        <p className="text-xs text-muted-foreground">Cada R$20 adiciona 1M tokens. Pagamento via PIX ou cartão.</p>
                        <div className="flex gap-2 flex-wrap">
                          {[20, 50, 100].map(val => (
                            <button key={val} onClick={() => setExtraTokensAmount(val)}
                              className={cn('px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors', extraTokensAmount === val ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-foreground/40')}>
                              R$ {val} <span className="opacity-60">({val / 20}M tokens)</span>
                            </button>
                          ))}
                        </div>
                        <div className="flex items-center gap-2">
                          <input type="number" min={20} step={10} value={extraTokensAmount}
                            onChange={e => setExtraTokensAmount(Math.max(20, Number(e.target.value)))}
                            className="w-24 h-8 border border-border rounded-lg px-2.5 text-xs bg-background text-center font-mono" />
                          <span className="text-xs text-muted-foreground">mínimo R$ 20</span>
                          <Button size="sm" onClick={handleBuyExtraTokens} disabled={buyingTokens} className="h-8 ml-auto">
                            {buyingTokens ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Comprar'}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Prompt CPF/CNPJ */}
              {cpfCnpjPrompt && (
                <div className="p-5 rounded-2xl border border-primary/30 bg-primary/5 space-y-3">
                  <p className="text-sm font-semibold">Informe o CPF ou CNPJ da empresa</p>
                  <p className="text-xs text-muted-foreground">Necessário para emissão de cobrança pelo Asaas.</p>
                  <div className="flex gap-2">
                    <Input
                      value={cpfCnpjInput}
                      onChange={e => setCpfCnpjInput(e.target.value)}
                      placeholder="00.000.000/0001-00 ou 000.000.000-00"
                      className="flex-1 font-mono text-sm h-10"
                      onKeyDown={e => e.key === 'Enter' && handleCpfCnpjSubmit()}
                    />
                    <Button size="sm" onClick={handleCpfCnpjSubmit} disabled={savingCpfCnpj} className="h-10 px-4">
                      {savingCpfCnpj ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Continuar'}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setCpfCnpjPrompt(null)} className="h-10">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Cards de planos */}
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-4">Planos disponíveis</p>
                <PlanoCards
                  onSelect={(plan, extra) => handleCheckout(plan, extra)}
                  currentPlan={currentPlanKey === 'basic' ? undefined : currentPlanKey}
                  loadingPlan={checkoutLoading ?? undefined}
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* ── INTEGRAÇÕES ────────────────────────────────────────── */}
      {tab === 'integracoes' && (
        <div className="space-y-4">
          <div className="p-6 rounded-2xl border border-border bg-card">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mt-0.5">
                  <Calendar className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold">Google Calendar</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Conecte sua agenda para agendamentos automáticos pelo agente SDR
                  </p>
                  {googleLoading && <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5"><Loader2 className="h-3 w-3 animate-spin" />Verificando…</p>}
                  {!googleLoading && googleStatus?.connected && (
                    <p className="text-xs text-emerald-400 mt-2 flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" />{googleStatus.email}</p>
                  )}
                  {!googleLoading && !googleStatus?.connected && (
                    <p className="text-xs text-muted-foreground mt-2">Não conectado</p>
                  )}
                </div>
              </div>

              {!googleLoading && (
                googleStatus?.connected ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleGoogleDisconnect}
                    disabled={disconnectingGoogle}
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10 shrink-0"
                  >
                    {disconnectingGoogle ? <Loader2 className="h-4 w-4 animate-spin" /> : <><X className="h-4 w-4 mr-1" />Desconectar</>}
                  </Button>
                ) : (
                  <a
                    href="/api/google/auth"
                    className="shrink-0 inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-[#dadce0] text-[#3c4043] text-sm font-medium shadow-sm hover:shadow-md transition-shadow select-none"
                    style={{ fontFamily: "'Google Sans', Roboto, sans-serif" }}
                  >
                    <svg viewBox="0 0 24 24" className="w-4 h-4" xmlns="http://www.w3.org/2000/svg">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    Conectar com Google
                  </a>
                )
              )}
            </div>
          </div>

          <div className="p-5 rounded-2xl border border-dashed border-border/50 flex items-center gap-4 opacity-50 select-none">
            <Zap className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Mais integrações em breve</p>
              <p className="text-xs text-muted-foreground">Slack, HubSpot, RD Station…</p>
            </div>
          </div>
        </div>
      )}

      {/* ── AUTOMAÇÃO ──────────────────────────────────────────── */}
      {tab === 'automacao' && <AutomacaoContent />}

      {/* ── SEGURANÇA ──────────────────────────────────────────── */}
      {tab === 'seguranca' && (
        <div className="space-y-4">
          <div className="p-6 rounded-2xl border border-border bg-card space-y-5">
            <div className="flex items-center gap-2 mb-1">
              <Shield className="h-4 w-4 text-primary" />
              <h2 className="font-semibold text-sm">Autenticação em dois fatores (MFA)</h2>
            </div>
            <p className="text-xs text-muted-foreground -mt-3">
              Adiciona uma camada extra de segurança exigindo um código do app autenticador no login
            </p>

            {mfaLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
              </div>
            ) : mfaFactor ? (
              /* MFA ATIVO */
              <div className="flex items-center justify-between gap-4 py-4 border-t border-border">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-green-500/10 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">MFA ativo</p>
                    <p className="text-xs text-muted-foreground mt-0.5">App autenticador vinculado</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleMfaDisable}
                  disabled={mfaDisabling}
                  className="text-destructive hover:text-destructive border-destructive/30 hover:border-destructive"
                >
                  {mfaDisabling ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Desativar'}
                </Button>
              </div>
            ) : mfaEnrollData ? (
              /* FLUXO DE ATIVAÇÃO */
              <div className="space-y-5 py-4 border-t border-border">
                <div>
                  <p className="text-sm font-medium mb-1">1. Escaneie o QR code</p>
                  <p className="text-xs text-muted-foreground mb-3">
                    Abra o Google Authenticator, Authy ou similar e escaneie o código abaixo
                  </p>
                  <div className="flex justify-center">
                    <div className="p-3 bg-white border border-border rounded-xl inline-block">
                      <img src={mfaEnrollData.qr_code} alt="QR Code MFA" width={160} height={160} />
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium mb-1">Ou insira manualmente</p>
                  <code className="text-xs bg-muted px-3 py-2 rounded-lg block text-center tracking-widest select-all">
                    {mfaEnrollData.secret}
                  </code>
                </div>

                <div>
                  <p className="text-sm font-medium mb-2">2. Digite o código gerado</p>
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder="000000"
                      maxLength={6}
                      value={mfaCode}
                      onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                      className="text-center tracking-widest font-mono text-lg"
                    />
                    <Button onClick={handleMfaVerify} disabled={mfaVerifying || mfaCode.length < 6}>
                      {mfaVerifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={() => { setMfaEnrollData(null); setMfaCode(''); }}
                >
                  Cancelar
                </Button>
              </div>
            ) : (
              /* MFA INATIVO */
              <div className="flex items-center justify-between gap-4 py-4 border-t border-border">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">MFA desativado</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Recomendado para proteção da conta</p>
                  </div>
                </div>
                <Button size="sm" onClick={handleMfaStart} disabled={mfaEnrolling}>
                  {mfaEnrolling ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                  Ativar MFA
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ConfiguracoesPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
      <ConfiguracoesContent />
    </Suspense>
  );
}
