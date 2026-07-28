'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { ZaapliLogo } from '@/components/brand/ZaapliLogo';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  // Supabase envia o token no hash — o client SDK troca automaticamente por sessão
  useEffect(() => {
    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: any) => {
      if (event === 'PASSWORD_RECOVERY') {
        setSessionReady(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast({ title: 'As senhas não coincidem', variant: 'destructive' });
      return;
    }
    if (password.length < 8) {
      toast({ title: 'A senha deve ter pelo menos 8 caracteres', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
      toast({ title: 'Senha redefinida com sucesso!' });
      setTimeout(() => { window.location.href = '/dashboard'; }, 2000);
    } catch {
      toast({ title: 'Não foi possível redefinir a senha. Tente solicitar um novo link.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-svh items-center justify-center" style={{ backgroundColor: '#080808' }}>
      <div
        className="flex flex-col w-full max-w-[440px] rounded-2xl p-10 gap-6"
        style={{ backgroundColor: '#0C0C0C', border: '1px solid #1A1A1A' }}
      >
        <div className="flex justify-center">
          <ZaapliLogo variant="full" iconSize={28} theme="dark" />
        </div>

        {done ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <p className="text-white font-semibold">Senha atualizada!</p>
            <p className="text-sm" style={{ color: '#888' }}>Redirecionando para o painel…</p>
          </div>
        ) : (
          <>
            <div>
              <h1 className="text-xl font-bold text-white">Nova senha</h1>
              <p className="text-sm mt-1" style={{ color: '#888' }}>
                {sessionReady ? 'Defina sua nova senha abaixo.' : 'Carregando sessão de recuperação…'}
              </p>
            </div>

            <form onSubmit={handleReset} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="new-password" className="text-sm font-medium" style={{ color: '#CCC' }}>Nova senha</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Mínimo 8 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading || !sessionReady}
                    className="pr-10 text-white placeholder:text-white/30"
                    style={{ backgroundColor: '#1A1A1A', borderColor: '#2A2A2A', color: '#fff' }}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors" style={{ color: '#666' }}>
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="confirm-password" className="text-sm font-medium" style={{ color: '#CCC' }}>Confirmar nova senha</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="Repita a senha"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  disabled={loading || !sessionReady}
                  className="text-white placeholder:text-white/30"
                  style={{ backgroundColor: '#1A1A1A', borderColor: '#2A2A2A', color: '#fff' }}
                />
              </div>

              <button
                type="submit"
                disabled={loading || !sessionReady}
                className="flex items-center justify-center gap-2 w-full rounded-full font-bold text-sm mt-1 transition-transform active:translate-y-px disabled:opacity-60"
                style={{ height: 44, backgroundColor: '#01573C', color: '#D8D8D8', boxShadow: '0 2px 0 0 #07261C' }}
              >
                {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Salvando…</> : 'Salvar nova senha'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
