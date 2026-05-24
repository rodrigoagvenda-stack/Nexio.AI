'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { Loader2, ShieldCheck } from 'lucide-react';
import { ZaapliLogo } from '@/components/brand/ZaapliLogo';

export default function MFAPage() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

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

  if (checking) {
    return (
      <div className="min-h-svh flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-svh flex items-center justify-center bg-white p-6 light" data-theme="light">
      <div className="w-full max-w-xs flex flex-col gap-6">
        <div className="flex justify-center">
          <a href="/">
            <ZaapliLogo variant="full" iconSize={34} theme="light" animate />
          </a>
        </div>

        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Verificação em duas etapas</h1>
          <p className="text-sm text-muted-foreground text-balance">
            Abra seu app autenticador e digite o código de 6 dígitos
          </p>
        </div>

        <form onSubmit={handleVerify} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="code">Código</Label>
            <Input
              id="code"
              type="text"
              inputMode="numeric"
              placeholder="000 000"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              required
              disabled={loading}
              autoFocus
              className="text-center text-2xl tracking-[0.4em] font-mono h-14"
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading || code.length < 6}>
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verificando…</> : 'Verificar'}
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          Perdeu acesso ao autenticador?{' '}
          <a href="/ajuda" className="underline underline-offset-4 hover:text-foreground">
            Falar com suporte
          </a>
        </p>
      </div>
    </div>
  );
}
