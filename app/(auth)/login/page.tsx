'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { OrbEffect } from '@/components/auth/OrbEffect';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

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

        if (adminUser) {
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
    <div className="relative min-h-screen bg-black flex items-center justify-center overflow-hidden">
      <OrbEffect />

      <div className="relative z-10 w-full max-w-md px-6">
        <Card className="backdrop-blur-2xl bg-white/5 border border-white/10 shadow-2xl">
          <CardHeader className="space-y-3 text-center">
            <div className="flex justify-center mb-2">
              <div className="w-16 h-1 bg-primary rounded-full" />
            </div>
            <CardTitle className="text-4xl font-bold text-white">
              vend<span className="text-primary">.</span>AI
            </CardTitle>
            <CardDescription className="text-white/80 text-base">
              Quem já queimou os barcos, entra por aqui.
            </CardDescription>
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
              <p className="text-white/60 text-sm">
                Não tem uma conta? Entre em contato com o admin.
              </p>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-white/60 text-sm mt-6">
          Sistema de CRM com automação e inteligência artificial
        </p>
      </div>
    </div>
  );
}
