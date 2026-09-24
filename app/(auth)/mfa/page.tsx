'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from '@/components/ui/use-toast';
import { Loader2, AlertCircle } from 'lucide-react';
import {
  AuthShell, Stack, Heading, IconBadge, badgeStroke, PrimaryButton, Banner, Copyright, fmtClock,
} from '@/components/auth/auth-ui';

const SYS = 'system-ui, sans-serif';
const DIGITS = 6;

export default function MFAPage() {
  const [digits, setDigits] = useState<string[]>(Array(DIGITS).fill(''));
  const [loading, setLoading] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [lockLeft, setLockLeft] = useState(0);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [supportLoading, setSupportLoading] = useState(false);
  const boxes = useRef<(HTMLInputElement | null)[]>([]);

  const code = digits.join('');
  const locked = !!lockedUntil;

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.mfa.listFactors().then(({ data }: { data: any }) => {
      const totp = data?.totp?.[0];
      if (totp) {
        setFactorId(totp.id);
      } else {
        window.location.href = '/dashboard';
      }
      setChecking(false);
    });
  }, []);

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

  const setAt = (i: number, v: string) => {
    setInvalid(false);
    setDigits((d) => d.map((x, j) => (j === i ? v : x)));
  };

  const onChange = (i: number, raw: string) => {
    const only = raw.replace(/\D/g, '');
    if (!only) return setAt(i, '');
    if (only.length > 1) {
      // colar o código inteiro, ou o autopreenchimento do celular
      const next = Array(DIGITS).fill('');
      only.slice(0, DIGITS).split('').forEach((c, j) => { next[j] = c; });
      setInvalid(false);
      setDigits(next);
      boxes.current[Math.min(only.length, DIGITS) - 1]?.focus();
      return;
    }
    setAt(i, only);
    if (i < DIGITS - 1) boxes.current[i + 1]?.focus();
  };

  const onKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      setAt(i - 1, '');
      boxes.current[i - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && i > 0) {
      boxes.current[i - 1]?.focus();
    } else if (e.key === 'ArrowRight' && i < DIGITS - 1) {
      boxes.current[i + 1]?.focus();
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!factorId || code.length < DIGITS || locked) return;
    setLoading(true);
    try {
      const res = await fetch('/api/auth/mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        window.location.href = data.next || '/dashboard';
        return;
      }
      if (res.status === 429) {
        setLockedUntil(Date.now() + (data.retryAfterSec ?? 60) * 1000);
      } else {
        setInvalid(true);
        boxes.current[DIGITS - 1]?.focus();
      }
    } catch {
      toast({ title: 'Não foi possível verificar. Tente novamente.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // Sai da sessão antes de ir ao suporte : impede contornar o MFA pelo link
  const handleContactSupport = async () => {
    setSupportLoading(true);
    await createClient().auth.signOut();
    window.location.href = '/ajuda';
  };

  if (checking) {
    return (
      <div className="min-h-svh flex items-center justify-center" style={{ background: '#0C0C0C' }}>
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: '#666' }} />
      </div>
    );
  }

  return (
    <AuthShell footer={<Copyright />}>
      <Stack gap={32}>
        <IconBadge>
          <svg width="34" height="34" viewBox="0 0 24 24">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" {...badgeStroke} />
            <path d="m9 12 2 2 4-4" {...badgeStroke} />
          </svg>
        </IconBadge>
        <Heading title="Verificação em duas etapas" sub="Abra o seu app autenticador e digite o código de 6 dígitos." gap={12} subLine={26} />

        <form onSubmit={handleVerify} style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          {locked && (
            <Banner tone="warn" title="Muitas tentativas">
              Por segurança, a verificação ficou pausada. Tente de novo em <b style={{ color: '#F3E3B0' }}>{fmtClock(lockLeft)}</b>.
            </Banner>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', gap: 10, opacity: locked ? 0.55 : 1 }}>
              {digits.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => { boxes.current[i] = el; }}
                  value={d}
                  onChange={(e) => onChange(i, e.target.value)}
                  onKeyDown={(e) => onKeyDown(i, e)}
                  onFocus={(e) => e.target.select()}
                  inputMode="numeric"
                  autoComplete={i === 0 ? 'one-time-code' : 'off'}
                  aria-label={`Dígito ${i + 1} de ${DIGITS}`}
                  aria-invalid={invalid}
                  autoFocus={i === 0}
                  disabled={loading || locked}
                  maxLength={DIGITS}
                  className={`zl-field${invalid ? ' zl-err' : ''}`}
                  style={{
                    flex: 1, minWidth: 0, width: '100%', height: 68, textAlign: 'center', color: '#fff', background: '#141414',
                    border: '1px solid #2A2A2A', borderRadius: 14, outline: 0, padding: 0,
                    fontFamily: '"Space Mono", ui-monospace, monospace', fontSize: 28, fontWeight: 700,
                  }}
                />
              ))}
            </div>
            {invalid && (
              <div role="alert" style={{ display: 'flex', alignItems: 'flex-start', gap: 10, color: '#FCA5A5', fontFamily: SYS, fontSize: 15, lineHeight: '22px' }}>
                <AlertCircle size={18} color="#F87171" strokeWidth={2.2} style={{ flexShrink: 0, marginTop: 1 }} />
                Código inválido. O código muda a cada 30 segundos, confira o app e tente de novo.
              </div>
            )}
          </div>

          <PrimaryButton loading={loading} disabled={code.length < DIGITS || locked}>{loading ? 'Verificando…' : 'Verificar'}</PrimaryButton>

          {!invalid && (
            <div style={{ textAlign: 'center', color: '#5A5A5A', fontFamily: SYS, fontSize: 13, lineHeight: '16px' }}>
              Google Authenticator · Authy · 1Password · Microsoft Authenticator
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, paddingTop: 20, borderTop: '1px solid #1C1C1C' }}>
            <div style={{ color: '#8A8A8A', fontFamily: SYS, fontSize: 14, lineHeight: '18px' }}>Perdeu o acesso ao autenticador?</div>
            <button
              type="button"
              onClick={handleContactSupport}
              disabled={supportLoading}
              className="zl-link"
              style={{ color: '#96F63C', fontFamily: SYS, fontSize: 14, fontWeight: 600, lineHeight: '18px', opacity: supportLoading ? 0.5 : 1 }}
            >
              {supportLoading ? 'Saindo…' : 'Sair e falar com o suporte'}
            </button>
          </div>
        </form>
      </Stack>
    </AuthShell>
  );
}
