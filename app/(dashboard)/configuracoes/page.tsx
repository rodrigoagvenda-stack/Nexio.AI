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
  User, Camera, CreditCard,
  CheckCircle2, Loader2, ExternalLink, Zap, TrendingUp, Rocket,
  AlertCircle, X, Shield, Check, Bot, UserMinus,
  ShieldCheck, Copy, CheckCheck, Volume2, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PlanoCards, type PlanKey } from '@/components/planos/PlanoCards';
import { ThemeToggle } from '@/components/ThemeToggle';
import { EquipeContent } from '@/components/configuracoes/EquipeContent';
import { RespostasRapidasContent } from '@/components/configuracoes/RespostasRapidasContent';
import { TemplatesHSMContent } from '@/components/configuracoes/TemplatesHSMContent';

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
  trial:   { name: 'Trial',          price: 0,   tokens: 5_000_000,  icon: Zap,        desc: 'Período de teste gratuito' },
  starter: { name: 'Zaapply Start',  price: 297, tokens: 5_000_000,  icon: TrendingUp, desc: 'SDR + atendimento + CRM Kanban + 1 número WhatsApp' },
  pro:     { name: 'Zaapply Growth', price: 497, tokens: 15_000_000, icon: Rocket,     desc: 'Tudo do Start + Google Calendar + 2 números WhatsApp' },
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

// numeros/saude removidos do nav : gravam em meta_wa_numbers, tabela que
// nenhum lugar do motor do SDR (engine.ts/inbound.ts/webhooks) lê. Escondido
// até a v2 de múltiplos números (roadmap) existir de verdade.
const TABS = ['perfil', 'plano', 'integracoes', 'equipe', 'respostas', 'templates', 'automacao', 'seguranca'] as const;
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

    </div>
  );
}

function ConfiguracoesContent() {
  const { user, authUser } = useUser();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>(() => {
    if (searchParams.get('checkout') || searchParams.get('expired') === 'trial') return 'plano'
    const t = searchParams.get('tab')
    if (t && (TABS as readonly string[]).includes(t)) return t as Tab
    return 'perfil'
  });

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
  const [checkoutFullName, setCheckoutFullName] = useState('');
  const [checkoutPhone, setCheckoutPhone] = useState('');
  const [savingCpfCnpj, setSavingCpfCnpj] = useState(false);

  const [googleStatus, setGoogleStatus] = useState<GoogleStatus | null>(null);
  const [googleLoading, setGoogleLoading] = useState(true);
  const [disconnectingGoogle, setDisconnectingGoogle] = useState(false);

  // Payment integrations
  const [paymentIntegrations, setPaymentIntegrations] = useState<{ platform: string; active: boolean }[]>([]);
  const [mpFormOpen, setMpFormOpen] = useState(false);
  const [kiwifyFormOpen, setKiwifyFormOpen] = useState(false);
  const [asaasFormOpen, setAsaasFormOpen] = useState(false);
  const [mpAccessToken, setMpAccessToken] = useState('');
  const [mpSecretKey, setMpSecretKey] = useState('');
  const [kiwifyToken, setKiwifyToken] = useState('');
  const [asaasAccessToken, setAsaasAccessToken] = useState('');
  const [asaasWebhookToken, setAsaasWebhookToken] = useState('');
  const [savingPlatform, setSavingPlatform] = useState<string | null>(null);
  const [disconnectingPlatform, setDisconnectingPlatform] = useState<string | null>(null);

  const [notifSound, setNotifSound] = useState(true);
  useEffect(() => {
    setNotifSound(localStorage.getItem('zaapply_notif_sound') !== 'false');
  }, []);
  const handleNotifSoundChange = (enabled: boolean) => {
    setNotifSound(enabled);
    localStorage.setItem('zaapply_notif_sound', String(enabled));
  };

  // MFA state
  const [mfaFactor, setMfaFactor] = useState<{ id: string } | null>(null);
  const [mfaLoading, setMfaLoading] = useState(true);
  const [mfaEnrolling, setMfaEnrolling] = useState(false);
  const [mfaEnrollData, setMfaEnrollData] = useState<{ id: string; qr_code: string; secret: string } | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaVerifying, setMfaVerifying] = useState(false);
  const [mfaDisabling, setMfaDisabling] = useState(false);
  const [mfaCopied, setMfaCopied] = useState(false);
  const [copiedAsaasUrl, setCopiedAsaasUrl] = useState(false);
  const [copiedKiwifyUrl, setCopiedKiwifyUrl] = useState(false);
  const [asaasLogs, setAsaasLogs] = useState<any[] | null>(null);
  const [loadingAsaasLogs, setLoadingAsaasLogs] = useState(false);

  useEffect(() => {
    const r = searchParams.get('checkout');
    if (r === 'success') toast({ title: '🎉 Assinatura ativada!' });
    if (r === 'cancelled') toast({ title: 'Pagamento cancelado.', variant: 'destructive' });
    const m = searchParams.get('meta');
    if (m === 'connected') { toast({ title: 'Meta Ads conectado com sucesso!' }); }
    if (m === 'denied') toast({ title: 'Conexão com Meta cancelada.', variant: 'destructive' });
    if (m === 'expired') toast({ title: 'Sessão OAuth expirada. Tente novamente.', variant: 'destructive' });
    if (m === 'error') toast({ title: 'Erro ao conectar com Meta. Tente novamente.', variant: 'destructive' });
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
    fetch('/api/payment-integrations').then(r => r.ok ? r.json() : null).then(d => { if (d) setPaymentIntegrations(d.integrations ?? []); }).catch(() => {});
  }, []);

  useEffect(() => {
    createClient().auth.mfa.listFactors().then(({ data }: { data: any }) => {
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

  const handleCopySecret = () => {
    if (!mfaEnrollData) return;
    navigator.clipboard.writeText(mfaEnrollData.secret);
    setMfaCopied(true);
    setTimeout(() => setMfaCopied(false), 2000);
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

  const doCheckout = async (plan: string, cpfCnpj?: string, extra = 0, fullName?: string, mobilePhone?: string) => {
    setCheckoutLoading(plan);
    try {
      const doc = cpfCnpj || company?.asaas_cpf_cnpj || '';
      const res = await fetch('/api/asaas/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan, cpfCnpj: doc, extraNumbers: extra, fullName, mobilePhone }) });
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
      setCheckoutFullName(user?.name || '');
      setCheckoutPhone('');
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
      else doCheckout(pending!, doc, pendingExtra, checkoutFullName || undefined, checkoutPhone || undefined);
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

  const handlePaymentSave = async (platform: string, config: Record<string, string>) => {
    setSavingPlatform(platform);
    try {
      const res = await fetch('/api/payment-integrations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ platform, config }) });
      const data = await res.json();
      if (!res.ok) { toast({ title: data.error ?? 'Erro ao salvar', variant: 'destructive' }); return; }
      setPaymentIntegrations(prev => {
        const filtered = prev.filter(i => i.platform !== platform);
        return [...filtered, { platform, active: true }];
      });
      if (platform === 'mercadopago') setMpFormOpen(false);
      if (platform === 'kiwify') setKiwifyFormOpen(false);
      if (platform === 'asaas') setAsaasFormOpen(false);
      const platformName = platform === 'mercadopago' ? 'Mercado Pago' : platform === 'kiwify' ? 'Kiwify' : 'Asaas';
      toast({ title: `${platformName} configurado com sucesso!` });
    } catch { toast({ title: 'Erro de conexão', variant: 'destructive' }); }
    finally { setSavingPlatform(null); }
  };

  const handlePaymentDisconnect = async (platform: string) => {
    setDisconnectingPlatform(platform);
    try {
      await fetch('/api/payment-integrations', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ platform }) });
      setPaymentIntegrations(prev => prev.filter(i => i.platform !== platform));
      const platformName = platform === 'mercadopago' ? 'Mercado Pago' : platform === 'kiwify' ? 'Kiwify' : 'Asaas';
      toast({ title: `${platformName} desconectado` });
    } catch { toast({ title: 'Erro ao desconectar', variant: 'destructive' }); }
    finally { setDisconnectingPlatform(null); }
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

  const TAB_LABELS: Record<Tab, string> = { perfil: 'Perfil', plano: 'Plano', integracoes: 'Integrações', equipe: 'Equipe', respostas: 'Respostas Rápidas', templates: 'Templates HSM', automacao: 'Automação', seguranca: 'Segurança' };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground text-sm mt-1">Gerencie sua conta, plano e integrações</p>
      </div>

      {/* Tab bar : overflow-x-auto rola, mas sem indício visual nenhum de que
          dá pra rolar (scrollbar escondida) — abas do fim (ex: Segurança)
          pareciam cortadas sem saída. Fades nas bordas avisam que tem mais. */}
      <div className="relative -mx-4 px-4 md:mx-0 md:px-0">
        <div className="flex gap-1 border-b border-border overflow-x-auto scrollbar-none flex-nowrap">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'px-4 py-2.5 text-sm font-medium transition-colors relative whitespace-nowrap flex-shrink-0',
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
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent" />
        <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-4 bg-gradient-to-r from-background to-transparent" />
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
              <p className="font-semibold">{user?.name || ':'}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
              {user?.department && <p className="text-xs text-muted-foreground mt-1">{user.department}</p>}
            </div>
            <p className="text-[11px] text-muted-foreground">JPG, PNG ou WEBP · máx 5MB</p>
            <div className="w-full pt-2 border-t border-border">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Tema</span>
                <ThemeToggle />
              </div>
            </div>
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

            <div className="p-6 rounded-2xl border border-border bg-card space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <Volume2 className="h-4 w-4 text-primary" />
                <h2 className="font-semibold text-sm">Notificações</h2>
              </div>
              <div className="flex items-center justify-between gap-4 pt-1 border-t border-border">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Volume2 className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Som de notificações</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      Reproduz um som quando novas mensagens chegam no Atendimento
                    </p>
                  </div>
                </div>
                <Switch checked={notifSound} onCheckedChange={handleNotifSoundChange} className="shrink-0" />
              </div>
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
                        {currentPlanKey === 'trial'
                          ? 'Período de teste'
                          : currentPlanKey === 'basic'
                          ? 'Sem assinatura ativa'
                          : `R$ ${currentPlan.price}/mês`}
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
                        {tokensUsed.toLocaleString('pt-BR')} / {fmtTokens(tokensLimit)}
                      </span>
                    </div>
                    <Progress value={tokensPct} className={cn('h-1.5', tokensPct > 90 ? '[&>div]:bg-red-500' : '')} />
                    {tokensPct > 90 && (
                      <p className="text-xs text-red-400 flex items-center gap-1.5"><AlertCircle className="h-3.5 w-3.5" />Quase no limite : considere fazer upgrade</p>
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
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">Dados para cobrança</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Necessário para emissão de boleto via Asaas.</p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => setCpfCnpjPrompt(null)} className="h-7 w-7 p-0 flex-shrink-0">
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {!user?.name && (
                      <Input
                        value={checkoutFullName}
                        onChange={e => setCheckoutFullName(e.target.value)}
                        placeholder="Nome completo"
                        className="text-sm h-10"
                      />
                    )}
                    <Input
                      value={checkoutPhone}
                      onChange={e => setCheckoutPhone(e.target.value)}
                      placeholder="WhatsApp (ex: 11 99999-9999)"
                      className="text-sm h-10"
                      type="tel"
                    />
                    <Input
                      value={cpfCnpjInput}
                      onChange={e => setCpfCnpjInput(e.target.value)}
                      placeholder="CPF ou CNPJ"
                      className="font-mono text-sm h-10"
                      onKeyDown={e => e.key === 'Enter' && handleCpfCnpjSubmit()}
                    />
                  </div>
                  <Button size="sm" onClick={handleCpfCnpjSubmit} disabled={savingCpfCnpj} className="w-full h-10">
                    {savingCpfCnpj ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Gerar cobrança'}
                  </Button>
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
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-white/5 border border-border flex items-center justify-center mt-0.5 p-1 overflow-hidden shrink-0">
                  <img src="/logos/google-calendar.svg?v=4" className="w-full h-full object-contain" alt="Google Calendar" />
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
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10 shrink-0 self-start sm:self-auto"
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

          {/* ── MERCADO PAGO ─────────────────────────────────── */}
          {(() => {
            const connected = paymentIntegrations.some(i => i.platform === 'mercadopago' && i.active);
            return (
              <div className={cn('p-5 rounded-2xl border bg-card flex items-start justify-between gap-4 transition-colors', connected ? 'border-emerald-500/30 bg-emerald-500/[0.03]' : 'border-border')}>
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-[#009EE3]/10 flex items-center justify-center shrink-0 p-1 overflow-hidden">
                    <img src="/logos/mercadopago.svg?v=4" className="w-full h-full object-contain" alt="Mercado Pago" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm">Mercado Pago</p>
                      {connected && <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-[10px] font-medium"><CheckCircle2 className="h-2.5 w-2.5" />Ativo</span>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">Receba notificações automáticas de pagamento confirmado</p>
                    {!connected && mpFormOpen && (
                      <div className="mt-3 space-y-2">
                        <div>
                          <Label className="text-xs">Access Token</Label>
                          <Input value={mpAccessToken} onChange={e => setMpAccessToken(e.target.value)} placeholder="APP_USR-..." className="h-8 text-xs mt-1 font-mono" />
                        </div>
                        <div>
                          <Label className="text-xs">Chave Secreta do Webhook</Label>
                          <Input value={mpSecretKey} onChange={e => setMpSecretKey(e.target.value)} placeholder="Chave gerada no painel MP" className="h-8 text-xs mt-1 font-mono" />
                        </div>
                        <p className="text-[10px] text-muted-foreground/70">Obtenha em Suas integrações → Notificações → Webhooks no painel do Mercado Pago.</p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  {connected ? (
                    <Button variant="ghost" size="sm" onClick={() => handlePaymentDisconnect('mercadopago')} disabled={disconnectingPlatform === 'mercadopago'} className="text-red-400 hover:text-red-300 hover:bg-red-500/10">
                      {disconnectingPlatform === 'mercadopago' ? <Loader2 className="h-4 w-4 animate-spin" /> : <><X className="h-4 w-4 mr-1" />Desconectar</>}
                    </Button>
                  ) : mpFormOpen ? (
                    <>
                      <Button variant="ghost" size="sm" onClick={() => setMpFormOpen(false)} className="text-muted-foreground">Cancelar</Button>
                      <Button size="sm" onClick={() => handlePaymentSave('mercadopago', { access_token: mpAccessToken, secret_key: mpSecretKey })} disabled={!mpAccessToken || !mpSecretKey || savingPlatform === 'mercadopago'}>
                        {savingPlatform === 'mercadopago' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setMpFormOpen(true)}>Configurar</Button>
                  )}
                </div>
              </div>
            );
          })()}

          {/* ── KIWIFY ───────────────────────────────────────── */}
          {(() => {
            const connected = paymentIntegrations.some(i => i.platform === 'kiwify' && i.active);
            return (
              <div className={cn('p-5 rounded-2xl border bg-card flex items-start justify-between gap-4 transition-colors', connected ? 'border-emerald-500/30 bg-emerald-500/[0.03]' : 'border-border')}>
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-[#2db56f]/10 flex items-center justify-center shrink-0 p-1 overflow-hidden">
                    <img src="/logos/kiwify.svg?v=3" className="w-full h-full object-contain" alt="Kiwify" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm">Kiwify</p>
                      {connected && <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-[10px] font-medium"><CheckCircle2 className="h-2.5 w-2.5" />Ativo</span>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">Detecta compras confirmadas de infoprodutos automaticamente</p>
                    {!connected && kiwifyFormOpen && (
                      <div className="mt-3 space-y-2">
                        <div>
                          <Label className="text-xs">URL do Webhook (cole no painel Kiwify)</Label>
                          <div className="flex items-center gap-1 mt-1">
                            <Input readOnly value={company ? `${typeof window !== 'undefined' ? window.location.origin : ''}/api/webhooks/payment/${company.id}/kiwify` : ''} className="h-8 text-xs font-mono bg-muted/30 cursor-text select-all" />
                            <button
                              type="button"
                              onClick={() => {
                                if (!company) return;
                                navigator.clipboard.writeText(`${window.location.origin}/api/webhooks/payment/${company.id}/kiwify`);
                                setCopiedKiwifyUrl(true);
                                setTimeout(() => setCopiedKiwifyUrl(false), 2000);
                              }}
                              className="h-8 w-8 flex items-center justify-center shrink-0 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                            >
                              {copiedKiwifyUrl ? <CheckCheck className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
                            </button>
                          </div>
                          <p className="text-[10px] text-muted-foreground/70 mt-1">Cole essa URL em Apps → Webhooks no painel da Kiwify ao criar o webhook.</p>
                        </div>
                        <div>
                          <Label className="text-xs">Token de Verificação</Label>
                          <Input value={kiwifyToken} onChange={e => setKiwifyToken(e.target.value)} placeholder="Token gerado automaticamente pela Kiwify" className="h-8 text-xs mt-1 font-mono" />
                          <p className="text-[10px] text-muted-foreground/70 mt-1">Após criar o webhook na Kiwify, copie o token gerado e cole aqui.</p>
                        </div>
                      </div>
                    )}
                    {connected && (
                      <div className="mt-2">
                        <Label className="text-xs text-muted-foreground">URL do Webhook</Label>
                        <div className="flex items-center gap-1 mt-1">
                          <Input readOnly value={company ? `${typeof window !== 'undefined' ? window.location.origin : ''}/api/webhooks/payment/${company.id}/kiwify` : ''} className="h-7 text-[11px] font-mono bg-muted/20 cursor-text select-all" />
                          <button
                            type="button"
                            onClick={() => {
                              if (!company) return;
                              navigator.clipboard.writeText(`${window.location.origin}/api/webhooks/payment/${company.id}/kiwify`);
                              setCopiedKiwifyUrl(true);
                              setTimeout(() => setCopiedKiwifyUrl(false), 2000);
                            }}
                            className="h-7 w-7 flex items-center justify-center shrink-0 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                          >
                            {copiedKiwifyUrl ? <CheckCheck className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  {connected ? (
                    <Button variant="ghost" size="sm" onClick={() => handlePaymentDisconnect('kiwify')} disabled={disconnectingPlatform === 'kiwify'} className="text-red-400 hover:text-red-300 hover:bg-red-500/10">
                      {disconnectingPlatform === 'kiwify' ? <Loader2 className="h-4 w-4 animate-spin" /> : <><X className="h-4 w-4 mr-1" />Desconectar</>}
                    </Button>
                  ) : kiwifyFormOpen ? (
                    <>
                      <Button variant="ghost" size="sm" onClick={() => setKiwifyFormOpen(false)} className="text-muted-foreground">Cancelar</Button>
                      <Button size="sm" onClick={() => handlePaymentSave('kiwify', { token: kiwifyToken })} disabled={!kiwifyToken || savingPlatform === 'kiwify'}>
                        {savingPlatform === 'kiwify' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setKiwifyFormOpen(true)}>Configurar</Button>
                  )}
                </div>
              </div>
            );
          })()}

          {/* ── ASAAS ────────────────────────────────────────── */}
          {(() => {
            const connected = paymentIntegrations.some(i => i.platform === 'asaas' && i.active);
            return (
              <div className={cn('p-5 rounded-2xl border bg-card flex items-start justify-between gap-4 transition-colors', connected ? 'border-emerald-500/30 bg-emerald-500/[0.03]' : 'border-border')}>
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-[#0030B9]/10 flex items-center justify-center shrink-0 p-1.5 overflow-hidden">
                    <img src="/logos/asaas.svg?v=2" className="w-full h-full object-contain" alt="Asaas" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm">Asaas</p>
                      {connected && <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-[10px] font-medium"><CheckCircle2 className="h-2.5 w-2.5" />Ativo</span>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">Dispare sequências em pagamento confirmado, boleto gerado ou vencido</p>
                    {!connected && asaasFormOpen && (
                      <div className="mt-3 space-y-2">
                        <div>
                          <Label className="text-xs">URL do Webhook (cole no painel Asaas)</Label>
                          <div className="flex items-center gap-1 mt-1">
                            <Input readOnly value={company ? `${typeof window !== 'undefined' ? window.location.origin : ''}/api/webhooks/payment/${company.id}/asaas` : ''} className="h-8 text-xs font-mono bg-muted/30 cursor-text select-all" />
                            <button
                              type="button"
                              onClick={() => {
                                if (!company) return;
                                navigator.clipboard.writeText(`${window.location.origin}/api/webhooks/payment/${company.id}/asaas`);
                                setCopiedAsaasUrl(true);
                                setTimeout(() => setCopiedAsaasUrl(false), 2000);
                              }}
                              className="h-8 w-8 flex items-center justify-center shrink-0 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                            >
                              {copiedAsaasUrl ? <CheckCheck className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
                            </button>
                          </div>
                          <p className="text-[10px] text-muted-foreground/70 mt-1">Cole essa URL em Menu → Integrações → Configurar Webhook no painel do Asaas.</p>
                        </div>
                        <div>
                          <Label className="text-xs">Chave de API Asaas</Label>
                          <Input value={asaasAccessToken} onChange={e => setAsaasAccessToken(e.target.value)} placeholder="$aact_prod_..." className="h-8 text-xs mt-1 font-mono" />
                        </div>
                        <div>
                          <Label className="text-xs">Token do Webhook</Label>
                          <Input value={asaasWebhookToken} onChange={e => setAsaasWebhookToken(e.target.value)} placeholder="Token gerado no painel Asaas" className="h-8 text-xs mt-1 font-mono" />
                        </div>
                        <p className="text-[10px] text-muted-foreground/70">Chave de API em Menu → Integrações → Chaves de API. Token do Webhook em Menu → Integrações → Configurar Webhook.</p>
                      </div>
                    )}
                    {connected && (
                      <div className="mt-2 space-y-2">
                        <div>
                          <Label className="text-xs text-muted-foreground">URL do Webhook</Label>
                          <div className="flex items-center gap-1 mt-1">
                            <Input readOnly value={company ? `${typeof window !== 'undefined' ? window.location.origin : ''}/api/webhooks/payment/${company.id}/asaas` : ''} className="h-7 text-[11px] font-mono bg-muted/20 cursor-text select-all" />
                            <button
                              type="button"
                              onClick={() => {
                                if (!company) return;
                                navigator.clipboard.writeText(`${window.location.origin}/api/webhooks/payment/${company.id}/asaas`);
                                setCopiedAsaasUrl(true);
                                setTimeout(() => setCopiedAsaasUrl(false), 2000);
                              }}
                              className="h-7 w-7 flex items-center justify-center shrink-0 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                            >
                              {copiedAsaasUrl ? <CheckCheck className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
                            </button>
                          </div>
                        </div>
                        {/* Histórico de eventos do webhook */}
                        <div>
                          <button
                            type="button"
                            onClick={async () => {
                              if (asaasLogs !== null) { setAsaasLogs(null); return; }
                              setLoadingAsaasLogs(true);
                              try {
                                const r = await fetch('/api/payment-integrations/events?platform=asaas');
                                const d = await r.json();
                                setAsaasLogs(d.events ?? []);
                              } catch { setAsaasLogs([]); } finally { setLoadingAsaasLogs(false); }
                            }}
                            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {loadingAsaasLogs ? <Loader2 className="h-3 w-3 animate-spin" /> : <ChevronRight className={cn('h-3 w-3 transition-transform', asaasLogs !== null && 'rotate-90')} />}
                            Histórico de eventos ({asaasLogs !== null ? asaasLogs.length : '?'})
                          </button>
                          {asaasLogs !== null && (
                            <div className="mt-2 space-y-1 max-h-64 overflow-y-auto pr-1">
                              {asaasLogs.length === 0 && (
                                <p className="text-[11px] text-muted-foreground/60 italic">Nenhum evento recebido ainda. Gere um boleto no Asaas e aguarde.</p>
                              )}
                              {asaasLogs.map((ev, i) => {
                                const statusColor = ev.status === 'ok' ? 'text-emerald-400' : ev.status === 'ignorado' ? 'text-yellow-400' : ev.status === 'sem_sequencia' ? 'text-orange-400' : 'text-red-400';
                                const statusLabel = ev.status === 'ok' ? 'Enviado' : ev.status === 'ignorado' ? 'Ignorado' : ev.status === 'sem_sequencia' ? 'Sem sequência' : 'Erro';
                                const date = ev.ts ? new Date(ev.ts).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
                                return (
                                  <div key={i} className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-[11px]">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className={cn('font-semibold', statusColor)}>{statusLabel}</span>
                                      <span className="text-muted-foreground/60">{date}</span>
                                    </div>
                                    {ev.eventoEntrada && <div className="text-muted-foreground mt-0.5">Gatilho: <span className="font-mono">{ev.eventoEntrada}</span></div>}
                                    {ev.email && <div className="text-muted-foreground">Email: {ev.email}</div>}
                                    {ev.telefone && <div className="text-muted-foreground">Telefone: {ev.telefone}</div>}
                                    {ev.mensagens_enviadas != null && <div className="text-muted-foreground">Mensagens: {ev.mensagens_enviadas}</div>}
                                    {ev.erro && <div className="text-red-400 mt-0.5">{ev.erro}</div>}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  {connected ? (
                    <Button variant="ghost" size="sm" onClick={() => handlePaymentDisconnect('asaas')} disabled={disconnectingPlatform === 'asaas'} className="text-red-400 hover:text-red-300 hover:bg-red-500/10">
                      {disconnectingPlatform === 'asaas' ? <Loader2 className="h-4 w-4 animate-spin" /> : <><X className="h-4 w-4 mr-1" />Desconectar</>}
                    </Button>
                  ) : asaasFormOpen ? (
                    <>
                      <Button variant="ghost" size="sm" onClick={() => setAsaasFormOpen(false)} className="text-muted-foreground">Cancelar</Button>
                      <Button size="sm" onClick={() => handlePaymentSave('asaas', { access_token: asaasAccessToken, webhook_token: asaasWebhookToken })} disabled={!asaasAccessToken || !asaasWebhookToken || savingPlatform === 'asaas'}>
                        {savingPlatform === 'asaas' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setAsaasFormOpen(true)}>Configurar</Button>
                  )}
                </div>
              </div>
            );
          })()}


          <div className="p-5 rounded-2xl border border-dashed border-border/50 flex items-center gap-4 opacity-50 select-none">
            <Zap className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Mais integrações em breve</p>
              <p className="text-xs text-muted-foreground">Novas integrações chegando em breve</p>
            </div>
          </div>
        </div>
      )}

      {/* ── EQUIPE ─────────────────────────────────────────────── */}
      {tab === 'equipe' && <EquipeContent />}

      {/* ── RESPOSTAS RÁPIDAS ───────────────────────────────────── */}
      {tab === 'respostas' && <RespostasRapidasContent />}

      {/* ── TEMPLATES HSM ───────────────────────────────────────── */}
      {tab === 'templates' && <TemplatesHSMContent />}

      {/* ── AUTOMAÇÃO ──────────────────────────────────────────── */}
      {tab === 'automacao' && <AutomacaoContent />}

      {/* ── SEGURANÇA ──────────────────────────────────────────── */}
      {tab === 'seguranca' && (
        <div className="max-w-xl space-y-4">
          {/* MFA card */}
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            {/* Card header */}
            <div className="px-6 py-5 border-b border-border flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Autenticação em dois fatores</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Código TOTP via app autenticador</p>
                </div>
              </div>
              {/* Status badge */}
              {!mfaLoading && (
                <span className={cn(
                  'text-[11px] font-semibold px-2.5 py-1 rounded-full',
                  mfaFactor
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/20'
                    : 'bg-muted text-muted-foreground ring-1 ring-border'
                )}>
                  {mfaFactor ? '● Ativo' : '○ Inativo'}
                </span>
              )}
            </div>

            <div className="px-6 py-5">
              {mfaLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
                </div>
              ) : mfaFactor ? (
                /* ── MFA ATIVO ── */
                <div className="space-y-4">
                  <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/15">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Conta protegida</p>
                      <p className="text-xs text-emerald-700/70 dark:text-emerald-400/70 mt-0.5 leading-relaxed">
                        Um código do app autenticador será exigido em cada login.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <p className="text-xs text-muted-foreground">Compatível com Google Authenticator, Authy, 1Password…</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleMfaDisable}
                      disabled={mfaDisabling}
                      className="shrink-0 text-destructive hover:text-destructive border-destructive/30 hover:border-destructive hover:bg-destructive/5"
                    >
                      {mfaDisabling ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : null}
                      Desativar
                    </Button>
                  </div>
                </div>
              ) : mfaEnrollData ? (
                /* ── FLUXO DE ATIVAÇÃO ── */
                <div className="space-y-6">
                  {/* Step 1 */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[11px] font-bold flex items-center justify-center shrink-0">1</span>
                      <p className="text-sm font-semibold">Escaneie o QR code</p>
                    </div>
                    <p className="text-xs text-muted-foreground pl-8">
                      Abra o Google Authenticator, Authy ou 1Password e escaneie o código.
                    </p>
                    <div className="flex flex-col items-center gap-3 pt-1">
                      <div className="p-4 bg-white rounded-2xl border border-border shadow-sm inline-block">
                        <img src={mfaEnrollData.qr_code} alt="QR Code MFA" width={180} height={180} />
                      </div>
                      {/* Manual key */}
                      <div className="w-full">
                        <p className="text-[11px] text-muted-foreground text-center mb-1.5">Ou insira a chave manualmente</p>
                        <div className="flex items-center gap-2 bg-muted rounded-xl px-3 py-2.5">
                          <code className="flex-1 text-[11px] tracking-widest font-mono text-center select-all break-all">
                            {mfaEnrollData.secret}
                          </code>
                          <button
                            onClick={handleCopySecret}
                            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-background"
                            title="Copiar"
                          >
                            {mfaCopied ? <CheckCheck className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-border" />

                  {/* Step 2 */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[11px] font-bold flex items-center justify-center shrink-0">2</span>
                      <p className="text-sm font-semibold">Confirme o código gerado</p>
                    </div>
                    <p className="text-xs text-muted-foreground pl-8">
                      Digite o código de 6 dígitos exibido no seu app para ativar.
                    </p>
                    <div className="flex gap-2 pt-1">
                      <Input
                        type="text"
                        inputMode="numeric"
                        placeholder="000 000"
                        maxLength={6}
                        value={mfaCode}
                        onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                        onKeyDown={(e) => e.key === 'Enter' && handleMfaVerify()}
                        className="text-center text-xl tracking-[0.4em] font-mono h-12 border-2 focus-visible:ring-0 focus-visible:border-primary transition-colors"
                        autoFocus
                      />
                      <Button
                        onClick={handleMfaVerify}
                        disabled={mfaVerifying || mfaCode.length < 6}
                        className="h-12 px-5 shrink-0"
                      >
                        {mfaVerifying ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Ativar'}
                      </Button>
                    </div>
                  </div>

                  <button
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline"
                    onClick={() => { setMfaEnrollData(null); setMfaCode(''); }}
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                /* ── MFA INATIVO ── */
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Adicione uma camada extra de segurança. Após ativar, cada login exigirá um código do seu app autenticador além da senha.
                  </p>
                  <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                    {['Google Authenticator', 'Authy', '1Password', 'Microsoft Authenticator', 'Bitwarden'].map(app => (
                      <span key={app} className="px-2.5 py-1 rounded-full bg-muted border border-border/60">{app}</span>
                    ))}
                  </div>
                  <Button onClick={handleMfaStart} disabled={mfaEnrolling} className="h-10">
                    {mfaEnrolling ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Preparando…</> : 'Ativar autenticação em dois fatores'}
                  </Button>
                </div>
              )}
            </div>
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
