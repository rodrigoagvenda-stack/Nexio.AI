'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { Loader2, Eye, EyeOff, ShieldCheck, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { OrbEffect } from '@/components/auth/OrbEffect';

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
          toast({ title: 'Bem-vindo, Admin!' });
          window.location.href = '/admin';
        } else {
          toast({ title: 'Login realizado com sucesso!' });
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

  const isAdmin = loginMode === 'admin';

  return (
    <div className="min-h-screen bg-[#0C0C0C] flex items-center justify-center p-4 overflow-hidden relative">
      {/* Background Orb Effect */}
      <OrbEffect />

      {/* Subtle grid pattern */}
      <div
        className="fixed inset-0 z-0 opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-sm"
      >
        <div
          className={cn(
            'rounded-2xl p-8 border backdrop-blur-xl transition-colors duration-500',
            isAdmin
              ? 'bg-[#30184C]/20 border-[#30184C]/30'
              : 'bg-white/[0.04] border-white/[0.08]'
          )}
        >
          {/* Logo */}
          <motion.div
            className="text-center mb-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <h1 className="text-3xl font-light tracking-tight text-white">
              nexio<span className="text-[#30184C]">.</span>ai
            </h1>
            <AnimatePresence mode="wait">
              <motion.p
                key={loginMode}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.2 }}
                className="text-sm text-zinc-500 mt-2"
              >
                {isAdmin ? 'Painel administrativo' : 'Acesse sua conta'}
              </motion.p>
            </AnimatePresence>
          </motion.div>

          {/* Toggle User/Admin */}
          <motion.div
            className="flex justify-center mb-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <div className="relative inline-flex rounded-xl bg-white/[0.06] p-1 w-full">
              {/* Animated background indicator */}
              <motion.div
                className={cn(
                  'absolute top-1 bottom-1 rounded-lg',
                  isAdmin ? 'bg-[#30184C]' : 'bg-white/10'
                )}
                layout
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                style={{
                  left: isAdmin ? '50%' : '4px',
                  right: isAdmin ? '4px' : '50%',
                }}
              />

              <button
                type="button"
                onClick={() => setLoginMode('user')}
                className={cn(
                  'relative z-10 flex items-center justify-center gap-2 flex-1 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors duration-300',
                  !isAdmin ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
                )}
              >
                <User className="h-4 w-4" />
                Usuário
              </button>
              <button
                type="button"
                onClick={() => setLoginMode('admin')}
                className={cn(
                  'relative z-10 flex items-center justify-center gap-2 flex-1 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors duration-300',
                  isAdmin ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
                )}
              >
                <ShieldCheck className="h-4 w-4" />
                Admin
              </button>
            </div>
          </motion.div>

          {/* Admin badge animation */}
          <AnimatePresence>
            {isAdmin && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: 'auto', marginBottom: 24 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#30184C]/20 border border-[#30184C]/30">
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-[#30184C]/40 flex items-center justify-center">
                    <ShieldCheck className="h-4 w-4 text-purple-300" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-purple-300">Modo Admin</p>
                    <p className="text-[11px] text-zinc-500">Acesso restrito a administradores</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Form */}
          <motion.form
            onSubmit={handleLogin}
            className="space-y-5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-zinc-400 text-xs uppercase tracking-wider">
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
                className={cn(
                  'bg-white/[0.04] border-white/[0.08] text-white placeholder:text-zinc-600 h-12 rounded-xl transition-colors duration-300',
                  'focus:border-[#30184C]/50 focus:ring-1 focus:ring-[#30184C]/30'
                )}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-zinc-400 text-xs uppercase tracking-wider">
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
                  className={cn(
                    'bg-white/[0.04] border-white/[0.08] text-white placeholder:text-zinc-600 h-12 rounded-xl pr-12 transition-colors duration-300',
                    'focus:border-[#30184C]/50 focus:ring-1 focus:ring-[#30184C]/30'
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <motion.div
              whileTap={{ scale: 0.98 }}
            >
              <Button
                type="submit"
                className={cn(
                  'w-full h-12 font-medium rounded-xl transition-all duration-500',
                  isAdmin
                    ? 'bg-[#30184C] text-white hover:bg-[#3d1f5e]'
                    : 'bg-white text-[#0C0C0C] hover:bg-zinc-200'
                )}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  <span className="flex items-center gap-2">
                    {isAdmin && <ShieldCheck className="h-4 w-4" />}
                    Entrar
                  </span>
                )}
              </Button>
            </motion.div>
          </motion.form>

          {/* Footer */}
          <motion.p
            className="text-center text-sm text-zinc-600 mt-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            Precisa de ajuda?{' '}
            <a
              href="mailto:suporte@nexio.ai"
              className="text-zinc-400 hover:text-white transition-colors"
            >
              Entre em contato
            </a>
          </motion.p>
        </div>

        {/* Bottom brand */}
        <motion.p
          className="text-center text-[11px] text-zinc-700 mt-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          &copy; {new Date().getFullYear()} Nexio.AI — Todos os direitos reservados
        </motion.p>
      </motion.div>
    </div>
  );
}
