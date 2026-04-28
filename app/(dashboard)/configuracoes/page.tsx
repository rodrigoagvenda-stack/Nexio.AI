'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/lib/hooks/useUser';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from '@/components/ui/use-toast';
import {
  User, Lock, Settings, Camera, CreditCard, Calendar,
  CheckCircle2, Loader2, ExternalLink, Zap, TrendingUp, Rocket,
  AlertCircle, RefreshCw, Sparkles, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CompanyFull {
  id: number;
  name: string;
  email: string;
  plan_type: string;
  plan_monthly_limit?: number;
  tokens_used?: number;
  tokens_limit?: number;
  is_active: boolean;
  subscription_expires_at?: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
}

interface GoogleStatus {
  connected: boolean;
  email: string | null;
  expires_at: string | null;
}

const PLAN_CONFIG = {
  basic: { name: 'Basic', price: 0, tokens: 0, color: 'zinc', icon: Zap, desc: 'Plano gratuito com recursos limitados' },
  starter: { name: 'Starter', price: 397, tokens: 5_000_000, color: 'green', icon: TrendingUp, desc: 'Ideal para pequenas equipes' },
  pro: { name: 'Pro', price: 597, tokens: 15_000_000, color: 'blue', icon: Rocket, desc: 'Para times em crescimento' },
  scale: { name: 'Scale', price: 997, tokens: 50_000_000, color: 'purple', icon: Sparkles, desc: 'Para operações escaláveis' },
} as const;

function formatTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function ConfiguracoesContent() {
  const { user, authUser } = useUser();
  const searchParams = useSearchParams();

  // Profile state
  const [loading, setLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoUrl, setPhotoUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [profileData, setProfileData] = useState({ name: '', email: '', description: '', department: '' });

  // Company / billing state
  const [company, setCompany] = useState<CompanyFull | null>(null);
  const [loadingCompany, setLoadingCompany] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  // Google state
  const [googleStatus, setGoogleStatus] = useState<GoogleStatus | null>(null);
  const [googleLoading, setGoogleLoading] = useState(true);
  const [disconnectingGoogle, setDisconnectingGoogle] = useState(false);

  // Tab from URL
  const checkoutResult = searchParams.get('checkout');
  const defaultTab = checkoutResult ? 'plano' : 'perfil';

  useEffect(() => {
    if (checkoutResult === 'success') {
      toast({ title: 'Assinatura ativada com sucesso!' });
    } else if (checkoutResult === 'cancelled') {
      toast({ title: 'Pagamento cancelado.', variant: 'destructive' });
    }
  }, [checkoutResult]);

  useEffect(() => {
    if (user) {
      setProfileData({
        name: user.name || '',
        email: user.email || '',
        description: user.description || '',
        department: user.department || '',
      });
      setPhotoUrl(user.photo_url || '');
    }
  }, [user]);

  const fetchCompany = useCallback(async () => {
    if (!user?.company_id) return;
    const supabase = createClient();
    const { data } = await supabase
      .from('companies')
      .select('id, name, email, plan_type, plan_monthly_limit, tokens_used, tokens_limit, is_active, subscription_expires_at, stripe_customer_id, stripe_subscription_id')
      .eq('id', user.company_id)
      .single();
    if (data) setCompany(data as CompanyFull);
    setLoadingCompany(false);
  }, [user?.company_id]);

  useEffect(() => { fetchCompany(); }, [fetchCompany]);

  const fetchGoogleStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/google/status');
      if (res.ok) setGoogleStatus(await res.json());
    } catch { /* silencioso */ } finally {
      setGoogleLoading(false);
    }
  }, []);

  useEffect(() => { fetchGoogleStatus(); }, [fetchGoogleStatus]);

  // ── Photo upload ──────────────────────────────────────────────────────────
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/user/upload-photo', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success) {
        setPhotoUrl(data.photoUrl);
        toast({ title: 'Foto atualizada!' });
        window.location.reload();
      } else {
        toast({ title: data.message || 'Erro no upload', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Erro ao fazer upload', variant: 'destructive' });
    } finally {
      setUploadingPhoto(false);
    }
  };

  // ── Save profile ──────────────────────────────────────────────────────────
  const handleSaveProfile = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('users')
        .update({ name: profileData.name, description: profileData.description, department: profileData.department })
        .eq('auth_user_id', authUser?.id);
      if (error) throw error;
      toast({ title: 'Perfil atualizado!' });
    } catch {
      toast({ title: 'Erro ao atualizar perfil', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // ── Stripe checkout ───────────────────────────────────────────────────────
  const handleCheckout = async (plan: string) => {
    setCheckoutLoading(plan);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      window.location.href = data.url;
    } catch (err: any) {
      toast({ title: err.message || 'Erro ao iniciar checkout', variant: 'destructive' });
      setCheckoutLoading(null);
    }
  };

  // ── Billing portal ────────────────────────────────────────────────────────
  const handlePortal = async () => {
    setPortalLoading(true);
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      window.location.href = data.url;
    } catch (err: any) {
      toast({ title: err.message || 'Erro ao abrir portal', variant: 'destructive' });
      setPortalLoading(false);
    }
  };

  // ── Google disconnect ─────────────────────────────────────────────────────
  const handleGoogleDisconnect = async () => {
    setDisconnectingGoogle(true);
    try {
      await fetch('/api/google/status', { method: 'DELETE' });
      setGoogleStatus({ connected: false, email: null, expires_at: null });
      toast({ title: 'Google Calendar desconectado' });
    } catch {
      toast({ title: 'Erro ao desconectar', variant: 'destructive' });
    } finally {
      setDisconnectingGoogle(false);
    }
  };

  const currentPlan = (company?.plan_type || 'basic') as keyof typeof PLAN_CONFIG;
  const tokensUsed = company?.tokens_used ?? 0;
  const tokensLimit = company?.tokens_limit ?? company?.plan_monthly_limit ?? 0;
  const tokensPct = tokensLimit > 0 ? Math.min((tokensUsed / tokensLimit) * 100, 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <Settings className="h-8 w-8 text-primary" />
          Configurações
        </h1>
        <p className="text-muted-foreground mt-1">Gerencie sua conta, plano e integrações</p>
      </div>

      <Tabs defaultValue={defaultTab}>
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="perfil" className="gap-1.5">
            <User className="h-4 w-4" />
            Perfil
          </TabsTrigger>
          <TabsTrigger value="plano" className="gap-1.5">
            <CreditCard className="h-4 w-4" />
            Plano
          </TabsTrigger>
          <TabsTrigger value="integracoes" className="gap-1.5">
            <Calendar className="h-4 w-4" />
            Integrações
          </TabsTrigger>
        </TabsList>

        {/* ── PERFIL ───────────────────────────────────────────────────────── */}
        <TabsContent value="perfil" className="mt-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Perfil do Usuário
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col items-center gap-4 py-4">
                  <Avatar className="h-24 w-24">
                    {photoUrl
                      ? <AvatarImage src={photoUrl} alt={user?.name} className="object-cover" />
                      : <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                          {user?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                        </AvatarFallback>
                    }
                  </Avatar>
                  <input ref={fileInputRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp" onChange={handlePhotoUpload} className="hidden" />
                  <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploadingPhoto} className="gap-2">
                    <Camera className="h-4 w-4" />
                    {uploadingPhoto ? 'Enviando...' : 'Alterar Foto'}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">JPG, PNG ou WEBP. Máximo 5MB</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name">Nome Completo</Label>
                  <Input id="name" value={profileData.name} onChange={(e) => setProfileData({ ...profileData, name: e.target.value })} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" value={profileData.email} disabled />
                  <p className="text-xs text-muted-foreground">O email não pode ser alterado</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="department">Cargo/Função</Label>
                  <Input id="department" value={profileData.department} onChange={(e) => setProfileData({ ...profileData, department: e.target.value })} placeholder="Ex: Gerente de Vendas" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio">Biografia</Label>
                  <Textarea id="bio" value={profileData.description} onChange={(e) => setProfileData({ ...profileData, description: e.target.value })} placeholder="Conte um pouco sobre você..." rows={3} />
                </div>

                <Button onClick={handleSaveProfile} disabled={loading} className="w-full">
                  {loading ? 'Salvando...' : 'Salvar Alterações'}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  Segurança
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Senha Atual</Label>
                  <Input type="password" placeholder="••••••••" />
                </div>
                <div className="space-y-2">
                  <Label>Nova Senha</Label>
                  <Input type="password" placeholder="••••••••" />
                </div>
                <div className="space-y-2">
                  <Label>Confirmar Nova Senha</Label>
                  <Input type="password" placeholder="••••••••" />
                </div>
                <Button variant="outline" className="w-full" disabled>
                  Alterar Senha
                </Button>
                <p className="text-xs text-muted-foreground text-center">Em breve</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── PLANO ────────────────────────────────────────────────────────── */}
        <TabsContent value="plano" className="mt-6 space-y-6">
          {loadingCompany ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Status atual */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Plano Atual
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'flex items-center justify-center w-10 h-10 rounded-xl',
                        currentPlan === 'basic' ? 'bg-zinc-100 dark:bg-zinc-800' :
                        currentPlan === 'starter' ? 'bg-green-100 dark:bg-green-900/30' :
                        currentPlan === 'pro' ? 'bg-blue-100 dark:bg-blue-900/30' :
                        'bg-purple-100 dark:bg-purple-900/30'
                      )}>
                        {(() => {
                          const Icon = PLAN_CONFIG[currentPlan]?.icon ?? Zap;
                          return <Icon className={cn(
                            'h-5 w-5',
                            currentPlan === 'basic' ? 'text-zinc-500' :
                            currentPlan === 'starter' ? 'text-green-600' :
                            currentPlan === 'pro' ? 'text-blue-600' :
                            'text-purple-600'
                          )} />;
                        })()}
                      </div>
                      <div>
                        <p className="font-semibold text-lg">{PLAN_CONFIG[currentPlan]?.name ?? currentPlan}</p>
                        <p className="text-sm text-muted-foreground">
                          {currentPlan === 'basic' ? 'Plano gratuito' : `R$ ${PLAN_CONFIG[currentPlan as keyof typeof PLAN_CONFIG]?.price}/mês`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {company?.is_active
                        ? <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0"><CheckCircle2 className="h-3 w-3 mr-1" />Ativo</Badge>
                        : <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Inativo</Badge>
                      }
                      {company?.stripe_subscription_id && (
                        <Button variant="outline" size="sm" onClick={handlePortal} disabled={portalLoading}>
                          {portalLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <ExternalLink className="h-4 w-4 mr-1" />}
                          Gerenciar Assinatura
                        </Button>
                      )}
                    </div>
                  </div>

                  {company?.subscription_expires_at && currentPlan !== 'basic' && (
                    <p className="text-xs text-muted-foreground">
                      Renova em {new Date(company.subscription_expires_at).toLocaleDateString('pt-BR')}
                    </p>
                  )}

                  {tokensLimit > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Tokens usados este mês</span>
                        <span className="font-medium">{formatTokens(tokensUsed)} / {formatTokens(tokensLimit)}</span>
                      </div>
                      <Progress value={tokensPct} className={cn('h-2', tokensPct > 90 ? '[&>div]:bg-red-500' : '[&>div]:bg-primary')} />
                      {tokensPct > 90 && (
                        <p className="text-xs text-red-500 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          Quase no limite — considere fazer upgrade
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Cards de planos */}
              <div>
                <h2 className="text-lg font-semibold mb-4">Planos disponíveis</h2>
                <div className="grid sm:grid-cols-3 gap-4">
                  {(['starter', 'pro', 'scale'] as const).map((plan) => {
                    const cfg = PLAN_CONFIG[plan];
                    const Icon = cfg.icon;
                    const isCurrent = currentPlan === plan;
                    return (
                      <Card key={plan} className={cn(
                        'relative transition-all',
                        isCurrent ? 'border-primary ring-1 ring-primary' : 'hover:border-border/80',
                        plan === 'pro' ? 'border-blue-500/50' : ''
                      )}>
                        {plan === 'pro' && !isCurrent && (
                          <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                            <Badge className="bg-blue-600 text-white text-[10px] px-2 py-0.5 border-0">Mais popular</Badge>
                          </div>
                        )}
                        {isCurrent && (
                          <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                            <Badge className="bg-primary text-primary-foreground text-[10px] px-2 py-0.5 border-0">Plano atual</Badge>
                          </div>
                        )}
                        <CardContent className="pt-6 pb-5 space-y-4">
                          <div className="flex items-center gap-2">
                            <Icon className={cn(
                              'h-5 w-5',
                              plan === 'starter' ? 'text-green-600' :
                              plan === 'pro' ? 'text-blue-600' :
                              'text-purple-600'
                            )} />
                            <span className="font-semibold">{cfg.name}</span>
                          </div>
                          <div>
                            <span className="text-3xl font-bold">R$ {cfg.price}</span>
                            <span className="text-muted-foreground text-sm">/mês</span>
                          </div>
                          <p className="text-sm text-muted-foreground">{cfg.desc}</p>
                          <div className="flex items-center gap-1.5 text-sm">
                            <Zap className="h-3.5 w-3.5 text-yellow-500" />
                            <span>{formatTokens(cfg.tokens)} tokens/mês</span>
                          </div>
                          <Button
                            className="w-full"
                            variant={isCurrent ? 'outline' : 'default'}
                            disabled={isCurrent || checkoutLoading === plan}
                            onClick={() => !isCurrent && handleCheckout(plan)}
                          >
                            {checkoutLoading === plan
                              ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Redirecionando...</>
                              : isCurrent ? 'Plano atual' : 'Assinar'
                            }
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </TabsContent>

        {/* ── INTEGRAÇÕES ──────────────────────────────────────────────────── */}
        <TabsContent value="integracoes" className="mt-6 space-y-4">
          {/* Google Calendar */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Google Calendar
              </CardTitle>
              <CardDescription>
                Conecte sua agenda para que o agente SDR possa agendar reuniões automaticamente
              </CardDescription>
            </CardHeader>
            <CardContent>
              {googleLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verificando conexão...
                </div>
              ) : googleStatus?.connected ? (
                <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-white dark:bg-green-900/30 flex items-center justify-center border border-green-200 dark:border-green-700">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Conectado</p>
                      <p className="text-xs text-muted-foreground">{googleStatus.email}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleGoogleDisconnect}
                    disabled={disconnectingGoogle}
                    className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    {disconnectingGoogle
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <><X className="h-4 w-4 mr-1" />Desconectar</>
                    }
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-muted/40 rounded-xl border border-dashed">
                  <div>
                    <p className="font-medium text-sm">Não conectado</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Autorize o acesso à sua agenda do Google para habilitar agendamentos automáticos
                    </p>
                  </div>
                  <Button asChild className="shrink-0">
                    <a href="/api/google/auth">
                      <Calendar className="h-4 w-4 mr-2" />
                      Conectar Google
                    </a>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Placeholder para futuras integrações */}
          <Card className="opacity-60 pointer-events-none select-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-muted-foreground">
                <Zap className="h-5 w-5" />
                Mais integrações em breve
              </CardTitle>
              <CardDescription>Slack, HubSpot, RD Station e mais</CardDescription>
            </CardHeader>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function ConfiguracoesPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    }>
      <ConfiguracoesContent />
    </Suspense>
  );
}
