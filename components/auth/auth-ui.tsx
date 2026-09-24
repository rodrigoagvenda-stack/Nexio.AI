'use client';

import type { ReactNode, InputHTMLAttributes } from 'react';
import { AlertCircle, Clock, Loader2 } from 'lucide-react';
import { ZaapliLogo } from '@/components/brand/ZaapliLogo';
import { AuthSlides } from './AuthSlides';

// Peças da tela de login/cadastro/recuperação/2FA, com as medidas do layout do Paper.
const SYS = 'system-ui, sans-serif';

/** CSS dos campos (foco, erro, autofill) e dos botões. Usado pelo login e pelo onboarding. */
export const AUTH_FIELD_CSS = `
        .zl-field { transition: border-color .15s, box-shadow .15s; }
        .zl-field:focus-within { border-color: #01573C !important; box-shadow: 0 0 0 .5px #01573C, 0 0 0 4px #01573C40; }
        .zl-field.zl-err, .zl-field.zl-err:focus-within { border-color: #E5484D !important; box-shadow: 0 0 0 .5px #E5484D, 0 0 0 4px #E5484D24; }
        .zl-field input { background: transparent; border: 0; outline: 0; color: #fff; font: 17px/22px ${SYS}; width: 100%; min-width: 0; height: 100%; padding: 0; }
        .zl-field input::placeholder { color: #5A5A5A; }
        .zl-field input:-webkit-autofill { -webkit-text-fill-color: #fff; -webkit-box-shadow: 0 0 0 1000px #141414 inset; caret-color: #fff; }
        .zl-btn { transition: transform .08s, opacity .15s; }
        .zl-btn:not(:disabled):active { transform: translateY(2px); }
        .zl-link { background: none; border: 0; padding: 0; cursor: pointer; }
        .zl-link:hover { text-decoration: underline; text-underline-offset: 3px; }
      `;

export function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" style={{ flexShrink: 0 }}>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

/** Estrutura da página: slides à esquerda, painel do formulário à direita. */
export function AuthShell({ children, footer }: { children: ReactNode; footer: ReactNode }) {
  return (
    <div className="flex min-h-svh" style={{ background: '#0C0C0C' }}>
      <style>{AUTH_FIELD_CSS}</style>

      <AuthSlides />

      <div
        className="flex flex-col w-full xl:w-[640px] xl:flex-shrink-0"
        style={{ background: '#0C0C0C', borderLeft: '1px solid #1A1A1A' }}
      >
        <div className="flex justify-center pt-10 xl:hidden">
          <ZaapliLogo variant="full" iconSize={30} theme="dark" />
        </div>
        <div className="flex flex-1 items-center justify-center px-6 sm:px-16 xl:px-24 py-10">
          <div className="w-full max-w-[448px] xl:max-w-none">{children}</div>
        </div>
        <div className="flex flex-col gap-1.5 px-6 sm:px-16 xl:px-24 pb-10 text-center" style={{ fontFamily: SYS, fontSize: 13, lineHeight: '20px' }}>
          {footer}
        </div>
      </div>
    </div>
  );
}

export function FooterText({ children, dim }: { children: ReactNode; dim?: boolean }) {
  return <div style={{ color: dim ? '#444' : '#5A5A5A', lineHeight: dim ? '16px' : '20px' }}>{children}</div>;
}

export function LegalLinks({ verb }: { verb: string }) {
  return (
    <FooterText>
      {verb} você concorda com os{' '}
      <a href="/termos" target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-white transition-colors">Termos de Uso</a>
      {' '}e a{' '}
      <a href="/privacidade" target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-white transition-colors">Política de Privacidade</a>
    </FooterText>
  );
}

export function Copyright() {
  return <FooterText dim>&copy; {new Date().getFullYear()} Zaapply. Todos os direitos reservados</FooterText>;
}

export function Stack({ gap = 28, children }: { gap?: number; children: ReactNode }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap, width: '100%' }}>{children}</div>;
}

export function Heading({ title, sub, gap = 8, subLine = 22 }: { title: string; sub: ReactNode; gap?: number; subLine?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap }}>
      <h1 style={{ margin: 0, color: '#fff', fontFamily: SYS, fontSize: 36, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: '44px' }}>{title}</h1>
      <p style={{ margin: 0, color: subLine === 26 ? '#A3A3A3' : '#8A8A8A', fontFamily: SYS, fontSize: 17, lineHeight: `${subLine}px` }}>{sub}</p>
    </div>
  );
}

export function Tabs({ value, onChange }: { value: 'login' | 'signup'; onChange: (v: 'login' | 'signup') => void }) {
  return (
    <div role="tablist" style={{ display: 'flex', padding: 5, background: '#141414', borderRadius: 999 }}>
      {(['login', 'signup'] as const).map((t) => (
        <button
          key={t}
          type="button"
          role="tab"
          aria-selected={value === t}
          onClick={() => onChange(t)}
          style={{
            flex: 1, height: 44, border: 0, borderRadius: 999, cursor: 'pointer', fontFamily: SYS, fontSize: 15, fontWeight: 600,
            background: value === t ? '#0F3D2B' : 'transparent', color: value === t ? '#fff' : '#777', transition: 'background .15s, color .15s',
          }}
        >
          {t === 'login' ? 'Entrar' : 'Criar conta'}
        </button>
      ))}
    </div>
  );
}

export function GoogleButton({ label, loading, onClick }: { label: string; loading?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="zl-btn"
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, height: 52, width: '100%', background: '#141414', border: '1px solid #262626', borderRadius: 999, boxShadow: '0 3px 0 #1A1A1A', color: '#E5E5E5', fontFamily: SYS, fontSize: 16, fontWeight: 600, cursor: 'pointer' }}
    >
      {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <GoogleIcon />}
      {label}
    </button>
  );
}

export function OrDivider({ text }: { text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{ flex: 1, height: 1, background: '#1F1F1F' }} />
      <span style={{ color: '#666', fontFamily: SYS, fontSize: 14, lineHeight: '18px' }}>{text}</span>
      <div style={{ flex: 1, height: 1, background: '#1F1F1F' }} />
    </div>
  );
}

export function FieldLabel({ htmlFor, children, right }: { htmlFor?: string; children: ReactNode; right?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <label htmlFor={htmlFor} style={{ color: '#D0D0D0', fontFamily: SYS, fontSize: 15, fontWeight: 500, lineHeight: '18px' }}>{children}</label>
      {right}
    </div>
  );
}

/** Caixa do campo: o <input> vai dentro, e `trailing` é o ícone à direita (olho, check). */
export function FieldBox({ error, trailing, height = 56, children }: { error?: boolean; trailing?: ReactNode; height?: number; children: ReactNode }) {
  return (
    <div
      className={`zl-field${error ? ' zl-err' : ''}`}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, height, padding: '0 18px', boxSizing: 'border-box', background: '#141414', border: '1px solid #2A2A2A', borderRadius: 14 }}
    >
      {children}
      {trailing}
    </div>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} />;
}

export function PrimaryButton({ children, loading, disabled, type = 'submit', onClick }: { children: ReactNode; loading?: boolean; disabled?: boolean; type?: 'submit' | 'button'; onClick?: () => void }) {
  const off = disabled && !loading;
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className="zl-btn"
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 56, width: '100%', flexShrink: 0, borderRadius: 999, fontFamily: SYS, fontSize: 17, fontWeight: 700, cursor: off ? 'not-allowed' : 'pointer',
        background: off ? '#1A1A1A' : '#01573C', color: off ? '#5A5A5A' : '#fff',
        border: off ? '1px solid #262626' : '0', boxShadow: off ? 'none' : '0 3px 0 #07261C',
      }}
    >
      {loading && <Loader2 className="h-5 w-5 animate-spin" />}
      {children}
    </button>
  );
}

export function GhostButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="zl-btn"
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 56, width: '100%', flexShrink: 0, background: '#141414', border: '1px solid #262626', borderRadius: 999, boxShadow: '0 3px 0 #050505', color: '#fff', fontFamily: SYS, fontSize: 17, fontWeight: 600, cursor: 'pointer' }}
    >
      {children}
    </button>
  );
}

export function GreenLink({ children, onClick, size = 15, icon }: { children: ReactNode; onClick: () => void; size?: number; icon?: 'left' | 'right' }) {
  const chevron = (d: string) => (
    <svg width="16" height="16" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <path d={d} fill="none" stroke="#96F63C" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
  return (
    <button type="button" onClick={onClick} className="zl-link" style={{ display: 'inline-flex', alignItems: 'center', gap: icon ? 6 : 0, color: '#96F63C', fontFamily: SYS, fontSize: size, fontWeight: 600, lineHeight: '18px' }}>
      {icon === 'left' && chevron('m15 18-6-6 6-6')}
      {children}
      {icon === 'right' && chevron('m9 18 6-6-6-6')}
    </button>
  );
}

export function Banner({ tone, title, children }: { tone: 'error' | 'warn'; title: string; children: ReactNode }) {
  const c = tone === 'error'
    ? { bg: '#2B1414', border: '#5A2323', icon: '#F87171', title: '#FCA5A5', text: '#D99494' }
    : { bg: '#2A2410', border: '#4A3F16', icon: '#E9C46A', title: '#F3E3B0', text: '#C9B77A' };
  const Icon = tone === 'error' ? AlertCircle : Clock;
  return (
    <div role="alert" style={{ display: 'flex', alignItems: 'flex-start', gap: tone === 'error' ? 12 : 14, padding: tone === 'error' ? '14px 16px' : '16px 18px', background: c.bg, border: `1px solid ${c.border}`, borderRadius: 12 }}>
      <Icon size={tone === 'error' ? 18 : 20} color={c.icon} strokeWidth={2.2} style={{ flexShrink: 0, marginTop: 1 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: tone === 'error' ? 3 : 4 }}>
        <div style={{ color: c.title, fontFamily: SYS, fontSize: 15, fontWeight: 600, lineHeight: '18px' }}>{title}</div>
        <div style={{ color: c.text, fontFamily: SYS, fontSize: 14, lineHeight: '20px' }}>{children}</div>
      </div>
    </div>
  );
}

export function IconBadge({ children }: { children: ReactNode }) {
  return (
    <div style={{ width: 72, height: 72, borderRadius: 36, background: '#12301F', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {children}
    </div>
  );
}

export const badgeStroke = { fill: 'none', stroke: '#96F63C', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

export function HintCard({ children, resendLeft, onResend }: { children: ReactNode; resendLeft: number; onResend: () => void }) {
  const ready = resendLeft <= 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 20, background: '#101010', border: '1px solid #1C1C1C', borderRadius: 16 }}>
      <div style={{ color: '#D4D4D4', fontFamily: SYS, fontSize: 15, lineHeight: '22px' }}>{children}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ color: '#737373', fontFamily: SYS, fontSize: 15, lineHeight: '18px' }}>
          {ready ? 'Já pode reenviar' : `Reenviar disponível em ${fmtClock(resendLeft)}`}
        </span>
        <button
          type="button"
          onClick={onResend}
          disabled={!ready}
          className="zl-link"
          style={{ color: ready ? '#96F63C' : '#4A4A4A', fontFamily: SYS, fontSize: 15, fontWeight: 600, lineHeight: '18px', cursor: ready ? 'pointer' : 'default' }}
        >
          Reenviar e-mail
        </button>
      </div>
    </div>
  );
}

export function fmtClock(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Força da senha para as 4 barrinhas e a lista de regras do cadastro. */
export function passwordChecks(pw: string) {
  const len = pw.length >= 8;
  const mix = /[A-Za-z]/.test(pw) && /\d/.test(pw);
  const bars = [len, mix, pw.length >= 10, /[^A-Za-z0-9]/.test(pw)].filter(Boolean).length;
  return { len, mix, bars, ok: len && mix };
}
