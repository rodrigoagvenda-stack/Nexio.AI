'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { Loader2, Eye, EyeOff, ShieldCheck, User } from 'lucide-react';
import { cn } from '@/lib/utils';

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loginMode, setLoginMode] = useState<'user' | 'admin'>('user');

  const isAdmin = loginMode === 'admin';

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

        if (loginMode === 'admin') {
          if (!adminUser) {
            await supabase.auth.signOut();
            throw new Error('Você não tem permissão de administrador');
          }
          window.location.href = '/admin';
        } else {
          window.location.href = '/dashboard';
        }
      }
    } catch (error: any) {
      console.error('Login error:', error);
      toast({ title: error.message || 'Email ou senha incorretos', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/api/auth/callback`,
        },
      });
      if (error) throw error;
    } catch (error: any) {
      toast({ title: error.message || 'Erro ao entrar com Google', variant: 'destructive' });
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">

          {/* Logo */}
          <div className="text-center mb-8">
            <img
              src="https://qbhxmgzogjqokjqvzunp.supabase.co/storage/v1/object/public/branding/nexio%20ai%20logo%20branca.png"
              alt="Nexio.AI"
              style={{ height: '36px', width: 'auto', display: 'block', margin: '0 auto', filter: 'invert(1)' }}
            />
            <p className="text-sm text-gray-400 mt-2">
              {isAdmin ? 'Painel administrativo' : 'Acesse sua conta'}
            </p>
          </div>

          {/* Toggle Usuário / Admin */}
          <div className="flex rounded-xl bg-gray-100 p-1 mb-6">
            <button
              type="button"
              onClick={() => setLoginMode('user')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-lg transition-all',
                !isAdmin ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
              )}
            >
              <User className="h-3.5 w-3.5" />
              Usuário
            </button>
            <button
              type="button"
              onClick={() => setLoginMode('admin')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-lg transition-all',
                isAdmin ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
              )}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              Admin
            </button>
          </div>

          {/* Google — só para usuário */}
          {!isAdmin && (
            <>
              <Button
                type="button"
                variant="outline"
                className="w-full h-11 rounded-xl border-gray-200 text-gray-700 font-medium hover:bg-gray-50 gap-2"
                onClick={handleGoogleLogin}
                disabled={googleLoading}
              >
                {googleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />}
                Entrar com Google
              </Button>

              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px bg-gray-100" />
                <span className="text-xs text-gray-400">ou</span>
                <div className="flex-1 h-px bg-gray-100" />
              </div>
            </>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className="h-11 rounded-xl border-gray-200 bg-white text-gray-900 placeholder:text-gray-300 focus:border-gray-400 focus:ring-0"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                Senha
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="h-11 rounded-xl border-gray-200 bg-white text-gray-900 placeholder:text-gray-300 pr-11 focus:border-gray-400 focus:ring-0"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className={cn(
                'w-full h-11 rounded-xl font-medium transition-all',
                isAdmin
                  ? 'bg-green-700 hover:bg-green-800 text-white'
                  : 'bg-gray-900 hover:bg-gray-800 text-white'
              )}
              disabled={loading}
            >
              {loading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Entrando...</>
              ) : (
                <span className="flex items-center gap-2">
                  {isAdmin && <ShieldCheck className="h-4 w-4" />}
                  Entrar
                </span>
              )}
            </Button>
          </form>

          {/* Footer link */}
          <p className="text-center text-sm text-gray-400 mt-6">
            Precisa de ajuda?{' '}
            <a href="mailto:contato@nexioai.online" className="text-gray-600 hover:text-gray-900 transition-colors">
              Entre em contato
            </a>
          </p>
        </div>

        {/* Bottom */}
        <div className="text-center mt-5 space-y-1">
          <p className="text-[11px] text-gray-400">
            &copy; {new Date().getFullYear()} Nexio.AI — Todos os direitos reservados
          </p>
          <div className="flex items-center justify-center gap-3 text-[11px] text-gray-400">
            <a href="/termos" className="hover:text-gray-600 transition-colors">Termos de Uso</a>
            <span>·</span>
            <a href="/privacidade" className="hover:text-gray-600 transition-colors">Privacidade</a>
            <span>·</span>
            <a href="/cookies" className="hover:text-gray-600 transition-colors">Cookies</a>
          </div>
        </div>

      </div>
    </div>
  );
}
