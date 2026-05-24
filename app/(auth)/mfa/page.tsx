'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import { Loader2, ShieldCheck } from 'lucide-react';
import { ZaapliLogo } from '@/components/brand/ZaapliLogo';

export default function MFAPage() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [supportLoading, setSupportLoading] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.mfa.listFactors().then(({ data }) => {
      const totp = data?.totp?.[0];
      if (totp) {
        setFactorId(totp.id);
      } else {
        window.location.href = '/dashboard';
      }
      setChecking(false);
    });
  }, []);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!factorId) return;
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId });
      if (challengeErr) throw challengeErr;

      const { error: verifyErr } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code,
      });
      if (verifyErr) throw verifyErr;

      window.location.href = '/dashboard';
    } catch (err: any) {
      toast({ title: err.message || 'Código inválido', variant: 'destructive' });
      setCode('');
    } finally {
      setLoading(false);
    }
  };

  // Signs out before redirecting — prevents bypassing MFA by clicking the link
  const handleContactSupport = async () => {
    setSupportLoading(true);
    await createClient().auth.signOut();
    window.location.href = '/ajuda';
  };

  if (checking) {
    return (
      <div className="min-h-svh flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-svh flex items-center justify-center bg-white p-6 light" data-theme="light">
      <div className="w-full max-w-sm flex flex-col gap-8">
        {/* Logo */}
        <div className="flex justify-center">
          <a href="/">
            <ZaapliLogo variant="full" iconSize={34} theme="light" animate />
          </a>
        </div>

        {/* Header */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="h-7 w-7 text-primary" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-2xl font-bold tracking-tight">Verificação em duas etapas</h1>
            <p className="text-sm text-muted-foreground">
              Abra seu app autenticador e insira o código de 6 dígitos
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleVerify} className="flex flex-col gap-3">
          <Input
            type="text"
            inputMode="numeric"
            placeholder="000 000"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            required
            disabled={loading}
            autoFocus
            className="text-center text-3xl tracking-[0.5em] font-mono h-16 border-2 focus-visible:ring-0 focus-visible:border-primary transition-colors"
          />
          <Button
            type="submit"
            size="lg"
            className="w-full h-12 text-base font-semibold"
            disabled={loading || code.length < 6}
          >
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verificando…</> : 'Verificar'}
          </Button>
        </form>

        {/* Compatible apps hint */}
        <p className="text-center text-[11px] text-muted-foreground/70">
          Google Authenticator · Authy · 1Password · Microsoft Authenticator
        </p>

        {/* Support — signs out first to prevent MFA bypass */}
        <div className="text-center space-y-1 pt-2 border-t border-border/50">
          <p className="text-xs text-muted-foreground">Perdeu acesso ao autenticador?</p>
          <button
            onClick={handleContactSupport}
            disabled={supportLoading}
            className="text-xs text-primary hover:underline underline-offset-4 font-medium disabled:opacity-50"
          >
            {supportLoading ? 'Saindo…' : 'Sair e falar com suporte'}
          </button>
        </div>
      </div>
    </div>
  );
}
