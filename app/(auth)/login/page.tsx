'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loginMode, setLoginMode] = useState<'user' | 'admin'>('user');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        const { data: adminUser } = await supabase
          .from('admin_users')
          .select('*')
          .eq('user_id', data.user.id)
          .eq('is_active', true)
          .single();

        if (loginMode === 'admin') {
          if (!adminUser) {
            await supabase.auth.signOut();
            throw new Error('Você não tem permissão de administrador');
          }
          toast.success('Bem-vindo, Admin!');
          window.location.href = '/admin';
        } else {
          toast.success('Login realizado com sucesso!');
          window.location.href = '/dashboard';
        }
      }
    } catch (error: any) {
      console.error('Login error:', error);
      toast.error(error.message || 'Email ou senha incorretos');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-zinc-950 rounded-2xl p-8 border border-zinc-900">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-light tracking-tight text-white">
            nexio<span className="text-primary">.</span>ai
          </h1>
        </div>

        {/* Toggle */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex rounded-lg bg-zinc-900 p-1">
            <button
              type="button"
              onClick={() => setLoginMode('user')}
              className={cn(
                'px-4 py-2 text-sm font-medium rounded-md transition-all',
                loginMode === 'user'
                  ? 'bg-white text-black'
                  : 'text-zinc-400 hover:text-white'
              )}
            >
              Usuário
            </button>
            <button
              type="button"
              onClick={() => setLoginMode('admin')}
              className={cn(
                'px-4 py-2 text-sm font-medium rounded-md transition-all',
                loginMode === 'admin'
                  ? 'bg-white text-black'
                  : 'text-zinc-400 hover:text-white'
              )}
            >
              Admin
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-1">
            <Label htmlFor="email" className="text-zinc-400 text-sm">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              className="bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-600 focus:border-zinc-700 focus:ring-0 h-12"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="password" className="text-zinc-400 text-sm">Senha</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                className="bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-600 focus:border-zinc-700 focus:ring-0 h-12 pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full h-12 bg-white text-black hover:bg-zinc-200 font-medium"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Entrando...
              </>
            ) : (
              'Entrar'
            )}
          </Button>
        </form>

        {/* Footer */}
        <p className="text-center text-sm text-zinc-600 mt-6">
          Precisa de ajuda?{' '}
          <a href="mailto:suporte@nexio.ai" className="text-zinc-400 hover:text-white transition-colors">
            Entre em contato
          </a>
        </p>
      </div>
    </div>
  );
}
