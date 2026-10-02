'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from '@/components/ui/use-toast';
import { Eye, EyeOff } from 'lucide-react';
import {
  AuthShell, Stack, Heading, FieldLabel, FieldBox, TextInput, PrimaryButton,
  GreenLink, Copyright, IconBadge, badgeStroke, passwordChecks,
} from '@/components/auth/auth-ui';

function EyeToggle({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} aria-label={shown ? 'Ocultar senha' : 'Mostrar senha'} className="zl-link" style={{ color: '#8A948E', display: 'flex', flexShrink: 0 }}>
      {shown ? <EyeOff size={20} /> : <Eye size={20} />}
    </button>
  );
}

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [linkError, setLinkError] = useState(false);

  // A troca do code por sessão já aconteceu no servidor (/api/auth/confirm)
  // antes de chegar aqui -- o navegador não consegue fazer essa troca sozinho
  // porque o verificador PKCE fica num cookie só o servidor lê. Aqui só
  // confere se a sessão de fato veio junto (cookie já setado) ou se o
  // servidor mandou de volta com erro.
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    if (query.get('error')) {
      setLinkError(true);
      return;
    }
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }: { data: { session: unknown } }) => {
      if (session) setSessionReady(true);
      else setLinkError(true);
    });
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast({ title: 'As senhas não coincidem', variant: 'destructive' });
      return;
    }
    if (!passwordChecks(password).ok) {
      toast({ title: 'A senha precisa de 8 ou mais caracteres, com letras e números', variant: 'destructive' });
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

  if (done) {
    return (
      <AuthShell footer={<Copyright />}>
        <Stack gap={32}>
          <IconBadge>
            <svg width="34" height="34" viewBox="0 0 24 24"><path d="m5 13 4 4L19 7" {...badgeStroke} /></svg>
          </IconBadge>
          <Heading title="Senha atualizada!" sub="Redirecionando para o painel…" gap={12} subLine={26} />
        </Stack>
      </AuthShell>
    );
  }

  if (linkError) {
    return (
      <AuthShell footer={<Copyright />}>
        <Stack gap={32}>
          <IconBadge>
            <svg width="34" height="34" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" {...badgeStroke} /><path d="M12 8v5M12 16h.01" {...badgeStroke} /></svg>
          </IconBadge>
          <Heading title="Link expirado ou já usado" sub="Peça um novo link em &quot;esqueci minha senha&quot; na tela de login." gap={12} subLine={26} />
          <div><GreenLink icon="left" onClick={() => { window.location.href = '/login'; }}>Voltar para o login</GreenLink></div>
        </Stack>
      </AuthShell>
    );
  }

  const pw = passwordChecks(password);

  return (
    <AuthShell footer={<Copyright />}>
      <Stack>
        <Heading
          title="Nova senha"
          sub={sessionReady ? 'Defina sua nova senha abaixo.' : 'Carregando sessão de recuperação…'}
        />
        <form onSubmit={handleReset} style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <FieldLabel htmlFor="new-password">Nova senha</FieldLabel>
              <FieldBox trailing={<EyeToggle shown={showPassword} onToggle={() => setShowPassword((s) => !s)} />}>
                <TextInput id="new-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} disabled={loading || !sessionReady} placeholder="Mínimo 8 caracteres" />
              </FieldBox>
              <div style={{ display: 'flex', gap: 6 }} aria-hidden="true">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i < pw.bars ? '#01573C' : '#E2E7E4', transition: 'background .2s' }} />
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <FieldLabel htmlFor="confirm-password">Confirmar nova senha</FieldLabel>
              <FieldBox>
                <TextInput id="confirm-password" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} disabled={loading || !sessionReady} placeholder="Repita a senha" />
              </FieldBox>
            </div>
          </div>
          <PrimaryButton loading={loading} disabled={!sessionReady}>{loading ? 'Salvando…' : 'Salvar nova senha'}</PrimaryButton>
        </form>
      </Stack>
    </AuthShell>
  );
}
