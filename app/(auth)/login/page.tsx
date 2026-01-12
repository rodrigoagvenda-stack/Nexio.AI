'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Shield, User } from 'lucide-react';
import { OrbEffect } from '@/components/auth/OrbEffect';

export default function LoginPage() {
  const router = useRouter();
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

      if (error) {
        throw error;
      }

      if (data.user) {
        // Verificar se é admin
        const { data: adminUser } = await supabase
          .from('admin_users')
          .select('*')
          .eq('user_id', data.user.id)
          .eq('is_active', true)
          .single();

        // Validar modo de login
        if (loginMode === 'admin') {
          if (!adminUser) {
            await supabase.auth.signOut();
            throw new Error('Você não tem permissão de administrador');
          }
          toast.success('Bem-vindo, Admin!');
          window.location.href = '/admin';
        } else {
          // Usuários comuns e admins podem acessar o dashboard
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
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden" style={{ background: 'linear-gradient(135deg, #0f0c29 0%, #1a1042 50%, #24135f 100%)' }}>
      <OrbEffect />

      <div className="relative z-10 w-full max-w-[420px] px-6">
        <div className="backdrop-blur-xl bg-[#1a1435]/40 border border-white/10 rounded-3xl shadow-2xl p-10">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-5xl font-light text-white mb-2 tracking-tight">
              <span className="font-normal">nexio</span>
              <span className="text-purple-400">.</span>
              <span className="font-normal">ai</span>
            </h1>
            <p className="text-white/50 text-sm font-light mb-6">
              Keep it all together and you'll be fine
            </p>

            {/* Toggle Admin/Usuário */}
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setLoginMode('user')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-full transition-all text-sm font-medium ${
                  loginMode === 'user'
                    ? 'bg-gradient-to-r from-purple-600 to-purple-500 text-white shadow-lg shadow-purple-500/30'
                    : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80'
                }`}
              >
                <User className="h-4 w-4" />
                Usuário
              </button>
              <button
                type="button"
                onClick={() => setLoginMode('admin')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-full transition-all text-sm font-medium ${
                  loginMode === 'admin'
                    ? 'bg-gradient-to-r from-purple-600 to-purple-500 text-white shadow-lg shadow-purple-500/30'
                    : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80'
                }`}
              >
                <Shield className="h-4 w-4" />
                Admin
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-white/70 text-sm font-light pl-1">
                Email or Phone
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 h-12 rounded-xl transition-all"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="password" className="text-white/70 text-sm font-light pl-1">
                  Password
                </Label>
                <button
                  type="button"
                  className="text-white/40 text-xs hover:text-white/60 transition-colors font-light"
                >
                  Forgot Password
                </button>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 h-12 rounded-xl transition-all pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60 text-sm font-light"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white font-normal h-12 text-base rounded-xl shadow-lg shadow-purple-500/30 transition-all hover:shadow-purple-500/50 mt-8"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>

          {/* Footer */}
          <div className="mt-8 text-center">
            <p className="text-white/40 text-sm font-light">
              Novo por aqui?{' '}
              <span className="text-purple-400 hover:text-purple-300 transition-colors cursor-pointer font-normal">
                Entre em contato
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
