'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from '@/components/ui/use-toast';
import { Eye, EyeOff, Check } from 'lucide-react';
import {
  AuthShell, Stack, Heading, Tabs, GoogleButton, OrDivider, FieldLabel, FieldBox, TextInput,
  PrimaryButton, GhostButton, GreenLink, Banner, IconBadge, badgeStroke, HintCard,
  LegalLinks, Copyright, FooterText, fmtClock, passwordChecks,
} from '@/components/auth/auth-ui';

type View = 'login' | 'signup' | 'forgot' | 'forgotSent' | 'confirm';

const SYS = 'system-ui, sans-serif';
const RESEND_SECONDS = 30;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function EyeToggle({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={shown ? 'Ocultar senha' : 'Mostrar senha'}
      className="zl-link"
      style={{ color: '#777', display: 'flex', flexShrink: 0 }}
    >
      {shown ? <EyeOff size={20} /> : <Eye size={20} />}
    </button>
  );
}

export default function LoginPage() {
  const [view, setView] = useState<View>('login');

  // login
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // cadastro
  const [name, setName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [showSignupPassword, setShowSignupPassword] = useState(false);

  // recuperar senha
  const [forgotEmail, setForgotEmail] = useState('');

  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState<{ remaining: number | null } | null>(null);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [lockLeft, setLockLeft] = useState(0);
  const [resendLeft, setResendLeft] = useState(0);
  const [googleLoading, setGoogleLoading] = useState(false);

  // /signup redireciona para cá com ?tab=signup
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('tab') === 'signup') setView('signup');
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

  // Espera para reenviar e-mail
  useEffect(() => {
    if (resendLeft <= 0) return;
    const timer = setTimeout(() => setResendLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendLeft]);

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

  const sendSignup = async (): Promise<boolean> => {
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email: signupEmail, password: signupPassword }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 429) {
      const mins = Math.max(1, Math.ceil((data.retryAfterSec ?? 60) / 60));
      toast({ title: `Muitas tentativas de cadastro. Tente de novo em ${mins} min.`, variant: 'destructive' });
      return false;
    }
    if (!res.ok) throw new Error('signup_failed');
    return true;
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!EMAIL_RE.test(signupEmail)) {
      toast({ title: 'Digite um e-mail válido', variant: 'destructive' });
      return;
    }
    if (!passwordChecks(signupPassword).ok) {
      toast({ title: 'A senha precisa de 8 ou mais caracteres, com letras e números', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      if (await sendSignup()) {
        setResendLeft(RESEND_SECONDS);
        setView('confirm');
      }
    } catch {
      // Mensagem genérica : evita enumerar se email já existe
      toast({ title: 'Não foi possível criar a conta. Tente novamente.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleResendConfirm = async () => {
    if (resendLeft > 0) return;
    try {
      if (await sendSignup()) {
        setResendLeft(RESEND_SECONDS);
        toast({ title: 'E-mail reenviado' });
      }
    } catch {
      toast({ title: 'Não foi possível reenviar. Tente novamente.', variant: 'destructive' });
    }
  };

  const sendForgot = async (): Promise<boolean> => {
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: forgotEmail }),
    });
    if (res.status === 429) {
      const data = await res.json().catch(() => ({}));
      const mins = Math.max(1, Math.ceil((data.retryAfterSec ?? 60) / 60));
      toast({ title: `Muitos pedidos de link. Tente de novo em ${mins} min.`, variant: 'destructive' });
      return false;
    }
    return true;
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (await sendForgot()) {
        setResendLeft(RESEND_SECONDS);
        setView('forgotSent');
      }
    } catch {
      // Sempre mostrar sucesso : não revelar se email existe
      setResendLeft(RESEND_SECONDS);
      setView('forgotSent');
    } finally {
      setLoading(false);
    }
  };

  const handleResendForgot = async () => {
    if (resendLeft > 0) return;
    try {
      if (await sendForgot()) {
        setResendLeft(RESEND_SECONDS);
        toast({ title: 'E-mail reenviado' });
      }
    } catch {
      setResendLeft(RESEND_SECONDS);
    }
  };

  const handleGoogle = async () => {
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

  const goForgot = () => {
    setForgotEmail(email);
    setResendLeft(0);
    setView('forgot');
  };

  const locked = !!lockedUntil;
  const emailOk = EMAIL_RE.test(signupEmail);
  const pw = passwordChecks(signupPassword);

  /* ───────── Recuperar senha ───────── */
  if (view === 'forgot') {
    return (
      <AuthShell footer={<Copyright />}>
        <Stack>
          <div><GreenLink icon="left" onClick={() => setView('login')}>Voltar para o login</GreenLink></div>
          <Heading title="Recuperar senha" sub="Digite o e-mail da sua conta. Enviamos um link para você criar uma senha nova." gap={10} subLine={26} />
          <form onSubmit={handleForgotPassword} style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <FieldLabel htmlFor="forgot-email">E-mail da conta</FieldLabel>
              <FieldBox>
                <TextInput id="forgot-email" type="email" autoComplete="email" autoFocus required value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} disabled={loading} placeholder="seu@email.com" />
              </FieldBox>
            </div>
            <PrimaryButton loading={loading}>{loading ? 'Enviando…' : 'Enviar link de redefinição'}</PrimaryButton>
          </form>
        </Stack>
      </AuthShell>
    );
  }

  /* ───────── Link de redefinição enviado ───────── */
  if (view === 'forgotSent') {
    return (
      <AuthShell footer={<Copyright />}>
        <Stack gap={32}>
          <IconBadge>
            <svg width="34" height="34" viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2" {...badgeStroke} /><path d="m22 7-10 6L2 7" {...badgeStroke} /></svg>
          </IconBadge>
          <Heading title="Confira seu e-mail" sub="Se este e-mail estiver cadastrado, você recebe o link de redefinição em instantes." gap={12} subLine={26} />
          <HintCard resendLeft={resendLeft} onResend={handleResendForgot}>Não chegou? Olhe a caixa de spam e a aba Promoções.</HintCard>
          <GhostButton onClick={() => setView('login')}>Voltar para o login</GhostButton>
        </Stack>
      </AuthShell>
    );
  }

  /* ───────── Confirme seu e-mail (após cadastro) ───────── */
  if (view === 'confirm') {
    return (
      <AuthShell footer={<Copyright />}>
        <Stack gap={32}>
          <IconBadge>
            <svg width="34" height="34" viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2" {...badgeStroke} /><path d="m22 7-10 6L2 7" {...badgeStroke} /></svg>
          </IconBadge>
          <Heading title="Confira seu e-mail" sub={<>Enviamos um link para <span style={{ color: '#D4D4D4' }}>{signupEmail}</span>. Clique nele para ativar a conta e continuar.</>} gap={12} subLine={26} />
          <HintCard resendLeft={resendLeft} onResend={handleResendConfirm}>Não chegou? Olhe a caixa de spam e a aba Promoções.</HintCard>
          <div><GreenLink icon="left" onClick={() => setView('signup')}>Usar outro e-mail</GreenLink></div>
        </Stack>
      </AuthShell>
    );
  }

  /* ───────── Cadastro ───────── */
  if (view === 'signup') {
    return (
      <AuthShell footer={<><LegalLinks verb="Ao criar a conta" /><Copyright /></>}>
        <Stack gap={26}>
          <Heading title="Crie sua conta" sub="Leva menos de 2 minutos." />
          <Tabs value="signup" onChange={(v) => setView(v)} />
          <GoogleButton label="Cadastrar com Google" loading={googleLoading} onClick={handleGoogle} />
          <OrDivider text="ou cadastre com e-mail" />
          <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <FieldLabel htmlFor="name">Nome completo</FieldLabel>
                <FieldBox>
                  <TextInput id="name" type="text" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} disabled={loading} placeholder="Seu nome" />
                </FieldBox>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <FieldLabel htmlFor="signup-email">E-mail</FieldLabel>
                <FieldBox trailing={emailOk ? <Check size={20} color="#96F63C" strokeWidth={2.4} style={{ flexShrink: 0 }} /> : undefined}>
                  <TextInput id="signup-email" type="email" autoComplete="email" required value={signupEmail} onChange={(e) => setSignupEmail(e.target.value)} disabled={loading} placeholder="seu@email.com" />
                </FieldBox>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <FieldLabel htmlFor="signup-password">Senha</FieldLabel>
                <FieldBox trailing={<EyeToggle shown={showSignupPassword} onToggle={() => setShowSignupPassword((s) => !s)} />}>
                  <TextInput id="signup-password" type={showSignupPassword ? 'text' : 'password'} autoComplete="new-password" required value={signupPassword} onChange={(e) => setSignupPassword(e.target.value)} disabled={loading} placeholder="Crie uma senha" />
                </FieldBox>
                <div style={{ display: 'flex', gap: 6 }} aria-hidden="true">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i < pw.bars ? '#96F63C' : '#262626', transition: 'background .2s' }} />
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 20 }}>
                  {[{ ok: pw.len, label: '8 ou mais caracteres' }, { ok: pw.mix, label: 'Letras e números' }].map((r) => (
                    <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 6, color: r.ok ? '#96F63C' : '#666', fontFamily: SYS, fontSize: 14, lineHeight: '18px', transition: 'color .2s' }}>
                      <Check size={14} strokeWidth={3} style={{ flexShrink: 0, opacity: r.ok ? 1 : 0.35 }} />
                      {r.label}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <PrimaryButton loading={loading}>{loading ? 'Criando conta…' : 'Criar conta'}</PrimaryButton>
          </form>
        </Stack>
      </AuthShell>
    );
  }

  /* ───────── Entrar (com erro e trava de tentativas) ───────── */
  return (
    <AuthShell
      footer={locked
        ? <FooterText>Esperar evita que alguém tente adivinhar a sua senha.</FooterText>
        : <><LegalLinks verb="Ao continuar" /><Copyright /></>}
    >
      <Stack>
        <Heading title="Bem-vindo de volta" sub="Entre para continuar de onde parou." />
        <Tabs value="login" onChange={(v) => setView(v)} />
        <GoogleButton label="Continuar com Google" loading={googleLoading} onClick={handleGoogle} />
        <OrDivider text="ou entre com e-mail" />

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          {locked ? (
            <Banner tone="warn" title="Muitas tentativas">
              Por segurança, o acesso ficou pausado. Tente de novo em <b style={{ color: '#F3E3B0' }}>{fmtClock(lockLeft)}</b>.
            </Banner>
          ) : loginError ? (
            <Banner tone="error" title="E-mail ou senha incorretos">
              Confira os dados e tente de novo.
              {loginError.remaining !== null && loginError.remaining > 0 && loginError.remaining <= 3
                ? ` Você tem mais ${loginError.remaining} tentativa${loginError.remaining > 1 ? 's' : ''} antes de esperar alguns minutos.`
                : ''}
            </Banner>
          ) : null}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, opacity: locked ? 0.55 : 1 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <FieldLabel htmlFor="email">E-mail</FieldLabel>
              <FieldBox>
                <TextInput id="email" type="email" autoComplete="email" required value={email} onChange={(e) => { setEmail(e.target.value); setLoginError(null); }} disabled={loading || locked} placeholder="seu@email.com" />
              </FieldBox>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <FieldLabel htmlFor="password" right={locked ? undefined : <GreenLink size={14} onClick={goForgot}>Esqueci minha senha</GreenLink>}>Senha</FieldLabel>
              <FieldBox error={!!loginError && !locked} trailing={locked ? undefined : <EyeToggle shown={showPassword} onToggle={() => setShowPassword((s) => !s)} />}>
                <TextInput id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={(e) => { setPassword(e.target.value); setLoginError(null); }} disabled={loading || locked} placeholder="••••••••" />
              </FieldBox>
            </div>
          </div>

          <PrimaryButton loading={loading} disabled={locked}>
            {loading ? 'Entrando…' : locked ? `Entrar (volta em ${fmtClock(lockLeft)})` : 'Entrar'}
          </PrimaryButton>

          {locked && (
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <GreenLink icon="right" onClick={goForgot}>Esqueci minha senha</GreenLink>
            </div>
          )}
        </form>
      </Stack>
    </AuthShell>
  );
}
