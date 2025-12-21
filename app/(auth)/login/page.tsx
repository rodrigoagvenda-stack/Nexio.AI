'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, Shield, User } from 'lucide-react';
import { OrbEffect } from '@/components/auth/OrbEffect';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
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
          .eq('auth_user_id', data.user.id)
          .eq('is_active', true)
          .single();

        // Validar modo de login
        if (loginMode === 'admin') {
          if (!adminUser) {
            await supabase.auth.signOut();
            throw new Error('Você não tem permissão de administrador');
          }
          toast.success('Bem-vindo, Admin! 🛡️');
          window.location.href = '/admin';
        } else {
          if (adminUser) {
            toast.info('Você é um admin. Use o modo Admin para entrar.');
            await supabase.auth.signOut();
            return;
          }
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
    <div className="relative min-h-screen bg-black flex items-center justify-center overflow-hidden">
      <OrbEffect />

      <div className="relative z-10 w-full max-w-md px-6">
        <Card className="backdrop-blur-2xl bg-white/5 border border-white/10 shadow-2xl">
          <CardHeader className="space-y-4 text-center">
            <div className="flex justify-center mb-2">
              <div className="w-16 h-1 bg-primary rounded-full" />
            </div>
            <CardTitle className="text-5xl text-white">
              <span className="font-semibold">vend</span>
              <span className="text-primary font-semibold">.</span>
              <span className="font-normal">AI</span>
            </CardTitle>
            <CardDescription className="text-white/80 text-base leading-relaxed">
              Quem já queimou os barcos 🔥<br />
              entra por aqui.
            </CardDescription>

            {/* Toggle Admin/Usuário */}
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setLoginMode('user')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                  loginMode === 'user'
                    ? 'bg-primary text-black font-bold'
                    : 'bg-white/5 text-white/60 hover:bg-white/10'
                }`}
              >
                <User className="h-4 w-4" />
                Usuário
              </button>
              <button
                type="button"
                onClick={() => setLoginMode('admin')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                  loginMode === 'admin'
                    ? 'bg-primary text-black font-bold'
                    : 'bg-white/5 text-white/60 hover:bg-white/10'
                }`}
              >
                <Shield className="h-4 w-4" />
                Admin
              </button>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-white/90">
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
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-primary focus:ring-primary"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-white/90">
                  Senha
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-primary focus:ring-primary"
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-primary hover:bg-primary/90 text-black font-semibold py-6 text-base"
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
            <div className="mt-6 text-center">
              <p className="text-white/60 text-sm leading-relaxed">
                Não tem uma conta?<br />
                Entre em contato com o admin.
              </p>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-white/60 text-sm mt-6 leading-relaxed">
          Sistema de CRM com automação<br />
          e inteligência artificial
        </p>
      </div>
    </div>
  );
}
