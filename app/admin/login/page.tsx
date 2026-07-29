'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { Loader2, Eye, EyeOff, ShieldCheck } from 'lucide-react';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      if (data.user) {
        const { data: adminUser } = await supabase
          .from('admin_users')
          .select('id')
          .eq('auth_user_id', data.user.id)
          .eq('is_active', true)
          .single();

        if (!adminUser) {
          await supabase.auth.signOut();
          throw new Error('Acesso negado : conta sem permissão de administrador');
        }

        window.location.href = '/admin';
      }
    } catch (error: any) {
      toast({ title: error.message || 'Email ou senha incorretos', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-sm">
        {/* Logo / badge */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center mb-4 ring-1 ring-primary/30">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-xl font-bold text-white">Acesso Administrativo</h1>
          <p className="text-sm text-zinc-400 mt-1">Área restrita: apenas administradores</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-sm text-zinc-300">Email</Label>
            <Input
              type="email"
              placeholder="admin@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-primary"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm text-zinc-300">Senha</Label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-primary pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verificando…</>
              : <><ShieldCheck className="mr-2 h-4 w-4" />Entrar como Admin</>
            }
          </Button>
        </form>

        <p className="text-center text-[11px] text-zinc-600 mt-8">
          Acesso não autorizado será registrado.
        </p>
      </div>
    </div>
  );
}
