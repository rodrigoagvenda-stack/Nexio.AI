'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { Loader2, Eye, EyeOff, TrendingUp, Users, MessageCircle, AlertCircle, Clock } from 'lucide-react';
import { ZaapliLogo } from '@/components/brand/ZaapliLogo';

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

const SLIDES = [
  {
    icon: TrendingUp,
    title: 'CRM inteligente',
    desc: 'Kanban, pipeline e métricas em tempo real. Do lead ao fechamento em uma tela.',
  },
  {
    icon: MessageCircle,
    title: 'WhatsApp integrado',
    desc: 'Inbox multi-atendente com IA nativa. Responda mais rápido e feche mais.',
  },
  {
    icon: Users,
    title: 'Automações que vendem',
    desc: 'Follow-up, Anti Noshow e Remarketing automáticos enquanto você dorme.',
  },
];

const SLIDE_INTERVAL = 4000;
const SIGNUP_COOLDOWN_MS = 15_000;

type Step = 'login' | 'signup' | 'forgot';

export default function LoginPage() {
  const [tab, setTab] = useState<Step>('login');

  // login fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // signup fields
  const [name, setName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // forgot password field
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);

  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState<{ remaining: number | null } | null>(null);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [lockLeft, setLockLeft] = useState(0);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [slideIdx, setSlideIdx] = useState(0);

  // rate limit signup: timestamp da última tentativa
  const lastSignupAttempt = useRef<number>(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setSlideIdx(i => (i + 1) % SLIDES.length);
    }, SLIDE_INTERVAL);
    return () => clearInterval(timer);
  }, []);

  // Trava de tentativas: contagem regressiva quando o servidor pede para esperar
  useEffect(() => {
    if (!lockedUntil) return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));
      setLockLeft(left);
      if (left === 0) setLockedUntil(null);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [lockedUntil]);

  const fmtLock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockedUntil) return;
    setLoading(true);
    setLoginError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        window.location.href = data.next || '/dashboard';
        return;
      }
      if (res.status === 429 && data.retryAfterSec) {
        setLockedUntil(Date.now() + data.retryAfterSec * 1000);
        return;
      }
      // Nunca expor o motivo real ao usuário : evita enumeração de email
      setLoginError({ remaining: typeof data.remaining === 'number' ? data.remaining : null });
    } catch {
      toast({ title: 'Não foi possível entrar. Tente novamente.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    // Rate limit client-side: 15s entre tentativas
    const now = Date.now();
    if (now - lastSignupAttempt.current < SIGNUP_COOLDOWN_MS) {
      toast({ title: 'Aguarde alguns segundos antes de tentar novamente', variant: 'destructive' });
      return;
    }

    if (signupPassword !== confirmPassword) {
      toast({ title: 'As senhas não coincidem', variant: 'destructive' });
      return;
    }
    if (signupPassword.length < 8) {
      toast({ title: 'A senha deve ter pelo menos 8 caracteres', variant: 'destructive' });
      return;
    }

    lastSignupAttempt.current = now;
    setLoading(true);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email: signupEmail, password: signupPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 429) {
        const mins = Math.max(1, Math.ceil((data.retryAfterSec ?? 60) / 60));
        toast({ title: `Muitas tentativas de cadastro. Tente de novo em ${mins} min.`, variant: 'destructive' });
        return;
      }
      if (!res.ok) throw new Error('signup_failed');
      toast({ title: 'Se este email não estiver cadastrado, você receberá um link de confirmação em instantes.' });
      setTab('login');
      setEmail(signupEmail);
    } catch {
      // Mensagem genérica : evita enumerar se email já existe
      toast({ title: 'Não foi possível criar a conta. Tente novamente.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail }),
      });
      if (res.status === 429) {
        const data = await res.json().catch(() => ({}));
        const mins = Math.max(1, Math.ceil((data.retryAfterSec ?? 60) / 60));
        toast({ title: `Muitos pedidos de link. Tente de novo em ${mins} min.`, variant: 'destructive' });
        return;
      }
      // Sempre mostrar sucesso : não revelar se email existe
      setForgotSent(true);
    } catch {
      setForgotSent(true);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/api/auth/callback` },
      });
      if (error) throw error;
    } catch {
      toast({ title: 'Erro ao entrar com Google. Tente novamente.', variant: 'destructive' });
      setGoogleLoading(false);
    }
  };

  const slide = SLIDES[slideIdx];
  const SlideIcon = slide.icon;

  const heading = tab === 'login' ? 'Bem-vindo de volta' : tab === 'signup' ? 'Crie sua conta' : 'Recuperar senha';
  const subheading = tab === 'login'
    ? 'Entre na sua conta para continuar'
    : tab === 'signup'
    ? 'Preencha os dados para começar'
    : 'Enviaremos um link para redefinir sua senha';

  return (
    <div className="flex min-h-svh" style={{ backgroundColor: '#080808' }}>
      {/* ── Esquerda: slides ── */}
      <div
        className="hidden lg:flex flex-col items-center justify-between flex-1 relative overflow-hidden p-12"
        style={{ background: 'linear-gradient(160deg, #07261C 0%, #01573C 55%, #0A3728 100%)' }}
      >
        <div className="w-full">
          <ZaapliLogo variant="full" iconSize={30} theme="dark" />
        </div>

        <div className="flex flex-col items-center text-center gap-6 max-w-sm">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-500"
            style={{ backgroundColor: 'rgba(150,246,60,0.12)', border: '1px solid rgba(150,246,60,0.22)' }}
          >
            <SlideIcon className="w-8 h-8" style={{ color: '#96F63C' }} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white leading-tight">{slide.title}</h2>
            <p className="text-sm mt-3 leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>{slide.desc}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => setSlideIdx(i)}
              className="rounded-full transition-all duration-300"
              style={{
                width: i === slideIdx ? 20 : 6,
                height: 6,
                backgroundColor: i === slideIdx ? '#96F63C' : 'rgba(255,255,255,0.25)',
              }}
            />
          ))}
        </div>
      </div>

      {/* ── Direita: formulário ── */}
      <div
        className="flex flex-col w-full lg:w-[520px] flex-shrink-0"
        style={{ backgroundColor: '#0C0C0C', borderLeft: '1px solid #1A1A1A' }}
      >
        {/* logo mobile */}
        <div className="flex justify-center pt-10 pb-2 lg:hidden">
          <ZaapliLogo variant="full" iconSize={30} theme="dark" />
        </div>

        <div className="flex flex-1 items-center justify-center px-12 py-8">
          <div className="w-full max-w-sm flex flex-col gap-6">
            {/* título dinâmico */}
            <div>
              <h1 className="text-2xl font-bold text-white">{heading}</h1>
              <p className="text-sm mt-1.5" style={{ color: '#888' }}>{subheading}</p>
            </div>

            {/* tabs (escondidas no forgot) */}
            {tab !== 'forgot' && (
              <div className="flex rounded-full p-1" style={{ backgroundColor: '#141414' }}>
                {(['login', 'signup'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className="flex-1 py-2 text-sm rounded-full font-semibold transition-all duration-150"
                    style={tab === t
                      ? { backgroundColor: '#0F3D2B', color: '#fff' }
                      : { color: '#666', background: 'transparent' }
                    }
                  >
                    {t === 'login' ? 'Entrar' : 'Criar conta'}
                  </button>
                ))}
              </div>
            )}

            {/* Google : somente login/signup */}
            {tab !== 'forgot' && (
              <>
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={googleLoading}
                  className="flex items-center justify-center gap-2.5 w-full rounded-full font-semibold text-sm transition-transform active:translate-y-px"
                  style={{ height: 44, backgroundColor: '#141414', color: '#D8D8D8', boxShadow: '0 2px 0 0 #1F1F1F', border: '1px solid #212121' }}
                >
                  {googleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />}
                  Continuar com Google
                </button>

                <div className="relative flex items-center gap-3">
                  <div className="flex-1 h-px" style={{ backgroundColor: '#1F1F1F' }} />
                  <span className="text-xs" style={{ color: '#555' }}>ou continue com email</span>
                  <div className="flex-1 h-px" style={{ backgroundColor: '#1F1F1F' }} />
                </div>
              </>
            )}

            {/* ── Form login ── */}
            {tab === 'login' && (
              <form onSubmit={handleLogin} className="flex flex-col gap-4">
                {lockedUntil ? (
                  <div className="flex gap-3 items-start rounded-xl p-3.5" style={{ backgroundColor: '#2A2410', border: '1px solid #4A3F16' }} role="alert">
                    <Clock className="h-5 w-5 mt-0.5 shrink-0" style={{ color: '#E9C46A' }} />
                    <div className="flex flex-col gap-1">
                      <p className="text-sm font-semibold" style={{ color: '#F3E3B0' }}>Muitas tentativas</p>
                      <p className="text-sm leading-snug" style={{ color: '#C9B77A' }}>
                        Por segurança, o acesso ficou pausado. Tente de novo em <b style={{ color: '#F3E3B0' }}>{fmtLock(lockLeft)}</b>.
                      </p>
                    </div>
                  </div>
                ) : loginError ? (
                  <div className="flex gap-3 items-start rounded-xl p-3.5" style={{ backgroundColor: '#2B1414', border: '1px solid #5A2323' }} role="alert">
                    <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" style={{ color: '#F87171' }} />
                    <div className="flex flex-col gap-1">
                      <p className="text-sm font-semibold" style={{ color: '#FCA5A5' }}>Email ou senha incorretos</p>
                      <p className="text-sm leading-snug" style={{ color: '#D99494' }}>
                        Confira os dados e tente de novo.
                        {loginError.remaining !== null && loginError.remaining > 0 && loginError.remaining <= 3
                          ? ` Você tem mais ${loginError.remaining} tentativa${loginError.remaining > 1 ? 's' : ''} antes de esperar alguns minutos.`
                          : ''}
                      </p>
                    </div>
                  </div>
                ) : null}

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="email" className="text-sm font-medium" style={{ color: '#CCC' }}>Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                    className="text-white placeholder:text-white/30"
                    style={{ backgroundColor: '#1A1A1A', borderColor: '#2A2A2A', color: '#fff' }}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-sm font-medium" style={{ color: '#CCC' }}>Senha</Label>
                    <button
                      type="button"
                      onClick={() => { setForgotEmail(email); setForgotSent(false); setTab('forgot'); }}
                      className="text-xs underline underline-offset-2 transition-colors"
                      style={{ color: '#666' }}
                    >
                      Esqueci minha senha
                    </button>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={loading}
                      className="pr-10 text-white placeholder:text-white/30"
                      style={{ backgroundColor: '#1A1A1A', borderColor: '#2A2A2A', color: '#fff' }}
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors" style={{ color: '#666' }}>
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !!lockedUntil}
                  className="flex items-center justify-center gap-2 w-full rounded-full font-bold text-sm mt-1 transition-transform active:translate-y-px disabled:opacity-60"
                  style={{ height: 44, backgroundColor: '#01573C', color: '#D8D8D8', boxShadow: '0 2px 0 0 #07261C' }}
                >
                  {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Entrando…</> : lockedUntil ? `Entrar (volta em ${fmtLock(lockLeft)})` : 'Entrar'}
                </button>

                <p className="text-center text-xs" style={{ color: '#555' }}>
                  Não tem uma conta?{' '}
                  <button type="button" onClick={() => setTab('signup')}
                    className="underline underline-offset-2 hover:text-white transition-colors" style={{ color: '#888' }}>
                    Criar conta
                  </button>
                </p>
              </form>
            )}

            {/* ── Form cadastro ── */}
            {tab === 'signup' && (
              <form onSubmit={handleSignup} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="name" className="text-sm font-medium" style={{ color: '#CCC' }}>Nome completo</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Seu nome"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    disabled={loading}
                    className="text-white placeholder:text-white/30"
                    style={{ backgroundColor: '#1A1A1A', borderColor: '#2A2A2A', color: '#fff' }}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="signup-email" className="text-sm font-medium" style={{ color: '#CCC' }}>Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="seu@email.com"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    required
                    disabled={loading}
                    className="text-white placeholder:text-white/30"
                    style={{ backgroundColor: '#1A1A1A', borderColor: '#2A2A2A', color: '#fff' }}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="signup-password" className="text-sm font-medium" style={{ color: '#CCC' }}>Senha</Label>
                  <div className="relative">
                    <Input
                      id="signup-password"
                      type={showSignupPassword ? 'text' : 'password'}
                      placeholder="Mínimo 8 caracteres"
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      required
                      disabled={loading}
                      className="pr-10 text-white placeholder:text-white/30"
                      style={{ backgroundColor: '#1A1A1A', borderColor: '#2A2A2A', color: '#fff' }}
                    />
                    <button type="button" onClick={() => setShowSignupPassword(!showSignupPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors" style={{ color: '#666' }}>
                      {showSignupPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="confirm-password" className="text-sm font-medium" style={{ color: '#CCC' }}>Confirmar senha</Label>
                  <div className="relative">
                    <Input
                      id="confirm-password"
                      type={showConfirm ? 'text' : 'password'}
                      placeholder="Repita a senha"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      disabled={loading}
                      className="pr-10 text-white placeholder:text-white/30"
                      style={{ backgroundColor: '#1A1A1A', borderColor: '#2A2A2A', color: '#fff' }}
                    />
                    <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors" style={{ color: '#666' }}>
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center justify-center gap-2 w-full rounded-full font-bold text-sm mt-1 transition-transform active:translate-y-px disabled:opacity-60"
                  style={{ height: 44, backgroundColor: '#01573C', color: '#D8D8D8', boxShadow: '0 2px 0 0 #07261C' }}
                >
                  {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Criando conta…</> : 'Criar conta'}
                </button>

                <p className="text-center text-xs" style={{ color: '#555' }}>
                  Já tem uma conta?{' '}
                  <button type="button" onClick={() => setTab('login')}
                    className="underline underline-offset-2 hover:text-white transition-colors" style={{ color: '#888' }}>
                    Entrar
                  </button>
                </p>
              </form>
            )}

            {/* ── Form esqueci senha ── */}
            {tab === 'forgot' && (
              forgotSent ? (
                <div className="flex flex-col gap-4 text-center">
                  <p className="text-sm" style={{ color: '#AAA' }}>
                    Se este email estiver cadastrado, você receberá um link de redefinição em instantes.
                  </p>
                  <button
                    type="button"
                    onClick={() => { setTab('login'); setForgotSent(false); }}
                    className="text-sm underline underline-offset-2 transition-colors"
                    style={{ color: '#888' }}
                  >
                    Voltar para login
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="forgot-email" className="text-sm font-medium" style={{ color: '#CCC' }}>Email da conta</Label>
                    <Input
                      id="forgot-email"
                      type="email"
                      placeholder="seu@email.com"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      required
                      disabled={loading}
                      className="text-white placeholder:text-white/30"
                      style={{ backgroundColor: '#1A1A1A', borderColor: '#2A2A2A', color: '#fff' }}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="flex items-center justify-center gap-2 w-full rounded-full font-bold text-sm mt-1 transition-transform active:translate-y-px disabled:opacity-60"
                    style={{ height: 44, backgroundColor: '#01573C', color: '#D8D8D8', boxShadow: '0 2px 0 0 #07261C' }}
                  >
                    {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Enviando…</> : 'Enviar link de redefinição'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setTab('login')}
                    className="text-sm underline underline-offset-2 transition-colors text-center"
                    style={{ color: '#666' }}
                  >
                    Voltar para login
                  </button>
                </form>
              )
            )}
          </div>
        </div>

        {/* footer */}
        <div className="px-12 pb-8 text-center">
          <p className="text-[11px]" style={{ color: '#444' }}>
            Ao continuar você concorda com os{' '}
            <a href="/termos" target="_blank" className="underline underline-offset-2 hover:text-white transition-colors">Termos de Uso</a>
            {' '}e a{' '}
            <a href="/privacidade" target="_blank" className="underline underline-offset-2 hover:text-white transition-colors">Política de Privacidade</a>
          </p>
          <p className="text-[11px] mt-1" style={{ color: '#333' }}>&copy; {new Date().getFullYear()} Zaapply. Todos os direitos reservados</p>
        </div>
      </div>
    </div>
  );
}
