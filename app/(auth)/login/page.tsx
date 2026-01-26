'use client';

import { useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Shield, User, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import dynamic from 'next/dynamic';

// Carrega o Spline dinamicamente para evitar SSR
const Spline = dynamic(() => import('@splinetool/react-spline'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full bg-gradient-to-br from-purple-900 to-indigo-900">
      <div className="animate-pulse text-white/50">Carregando 3D...</div>
    </div>
  ),
});

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
    <div className="grid min-h-svh lg:grid-cols-2">
      {/* Lado esquerdo - Formulário */}
      <div className="flex flex-col gap-4 p-6 md:p-10 bg-background">
        <div className="flex justify-center gap-2 md:justify-start">
          <a href="#" className="flex items-center gap-2 font-medium">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <span className="text-xs font-bold">N</span>
            </div>
            <span className="text-xl">
              <span className="font-normal">nexio</span>
              <span className="text-primary font-bold">.</span>
              <span className="font-normal">ai</span>
            </span>
          </a>
        </div>

        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            <form onSubmit={handleLogin} className="flex flex-col gap-6">
              <div className="flex flex-col items-center gap-2 text-center">
                <h1 className="text-2xl font-bold">Entrar na sua conta</h1>
                <p className="text-balance text-sm text-muted-foreground">
                  Digite seu email para acessar o sistema
                </p>
              </div>

              {/* Toggle Admin/Usuário */}
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setLoginMode('user')}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-full transition-all text-sm font-medium',
                    loginMode === 'user'
                      ? 'bg-primary text-primary-foreground shadow-lg'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  )}
                >
                  <User className="h-4 w-4" />
                  Usuário
                </button>
                <button
                  type="button"
                  onClick={() => setLoginMode('admin')}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-full transition-all text-sm font-medium',
                    loginMode === 'admin'
                      ? 'bg-primary text-primary-foreground shadow-lg'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  )}
                >
                  <Shield className="h-4 w-4" />
                  Admin
                </button>
              </div>

              <div className="grid gap-6">
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="password">Senha</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={loading}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Entrando...
                    </>
                  ) : (
                    'Entrar'
                  )}
                </Button>
              </div>

              <div className="text-center text-sm text-muted-foreground">
                Precisa de ajuda?{' '}
                <a
                  href="mailto:suporte@nexio.ai"
                  className="underline underline-offset-4 hover:text-primary"
                >
                  Entre em contato
                </a>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Lado direito - Spline 3D */}
      <div className="relative hidden bg-gradient-to-br from-purple-900 to-indigo-900 lg:block overflow-hidden">
        <Spline
          scene="https://prod.spline.design/EI48OiEjBlC6GZvo/scene.splinecode"
          className="absolute inset-0 h-full w-full"
        />
      </div>
    </div>
  );
}
