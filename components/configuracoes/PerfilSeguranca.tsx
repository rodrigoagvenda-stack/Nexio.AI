'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCheck, CheckCircle2, Copy, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/lib/hooks/useUser';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { CARD, CardTitle, FIELD, FieldLabel, LIME, StatusPill } from './cfg-ui';

const initialsOf = (name?: string | null) => (name || 'U').split(/\s+/).filter(Boolean).map((n) => n[0]).join('').slice(0, 2).toUpperCase();

export function PerfilSeguranca() {
  const { user } = useUser();

  // ── Perfil ──
  const [profile, setProfile] = useState({ name: '', email: '', description: '', department: '' });
  const [photoUrl, setPhotoUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    setProfile({ name: user.name || '', email: user.email || '', description: user.description || '', department: user.department || '' });
    setPhotoUrl(user.photo_url || '');
  }, [user]);

  async function uploadPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch('/api/user/upload-photo', { method: 'POST', body: fd });
      const d = await res.json();
      if (!d.success) throw new Error(d.message || 'Erro no envio da foto');
      setPhotoUrl(d.photoUrl);
      toast({ variant: 'success', title: 'Foto atualizada' });
      window.location.reload();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Não foi possível trocar a foto', description: err?.message });
    } finally { setUploadingPhoto(false); e.target.value = ''; }
  }

  async function saveProfile() {
    setSaving(true);
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: profile.name, description: profile.description, department: profile.department }),
      });
      const d = await res.json();
      if (!d.success) throw new Error(d.message);
      toast({ variant: 'success', title: 'Perfil salvo' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Não foi possível salvar', description: err?.message });
    } finally { setSaving(false); }
  }

  // ── Preferências ──
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [notifSound, setNotifSound] = useState(true);
  useEffect(() => {
    setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
    try { setNotifSound(localStorage.getItem('zaapply_notif_sound') !== 'false'); } catch { /* sem armazenamento */ }
  }, []);

  function chooseTheme(next: 'dark' | 'light') {
    setTheme(next);
    document.documentElement.classList.toggle('dark', next === 'dark');
    try { localStorage.setItem('theme', next); } catch { /* o tema vale só nesta visita */ }
  }
  function changeSound(on: boolean) {
    setNotifSound(on);
    try { localStorage.setItem('zaapply_notif_sound', String(on)); } catch { /* sem armazenamento */ }
  }

  // ── Senha ──
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [changingPw, setChangingPw] = useState(false);

  async function changePassword() {
    if (pw.next !== pw.confirm) { toast({ variant: 'destructive', title: 'As senhas não conferem' }); return; }
    if (pw.next.length < 6) { toast({ variant: 'destructive', title: 'A nova senha precisa de pelo menos 6 caracteres' }); return; }
    setChangingPw(true);
    try {
      const sb = createClient();
      const { error: signInError } = await sb.auth.signInWithPassword({ email: profile.email, password: pw.current });
      if (signInError) throw new Error('Senha atual incorreta');
      const { error } = await sb.auth.updateUser({ password: pw.next });
      if (error) throw error;
      setPw({ current: '', next: '', confirm: '' });
      toast({ variant: 'success', title: 'Senha alterada' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Não foi possível alterar a senha', description: err?.message });
    } finally { setChangingPw(false); }
  }

  // ── Verificação em duas etapas ──
  const [factor, setFactor] = useState<{ id: string } | null>(null);
  const [mfaLoading, setMfaLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [enroll, setEnroll] = useState<{ id: string; qr_code: string; secret: string } | null>(null);
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [disabling, setDisabling] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    createClient().auth.mfa.listFactors().then(({ data }: { data: any }) => {
      setFactor(data?.totp?.[0] ?? null);
      setMfaLoading(false);
    }).catch(() => setMfaLoading(false));
  }, []);

  async function startMfa() {
    setEnrolling(true);
    try {
      const { data, error } = await createClient().auth.mfa.enroll({ factorType: 'totp' });
      if (error) throw error;
      setEnroll({ id: data.id, qr_code: data.totp.qr_code, secret: data.totp.secret });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Não foi possível iniciar', description: err?.message });
    } finally { setEnrolling(false); }
  }

  async function verifyMfa() {
    if (!enroll || code.length < 6) return;
    setVerifying(true);
    try {
      const sb = createClient();
      const { data: challenge, error: cErr } = await sb.auth.mfa.challenge({ factorId: enroll.id });
      if (cErr) throw cErr;
      const { error: vErr } = await sb.auth.mfa.verify({ factorId: enroll.id, challengeId: challenge.id, code });
      if (vErr) throw vErr;
      setFactor({ id: enroll.id });
      setEnroll(null);
      setCode('');
      toast({ variant: 'success', title: 'Verificação em duas etapas ativada', description: 'Sua conta está protegida.' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Código inválido', description: err?.message });
      setCode('');
    } finally { setVerifying(false); }
  }

  async function disableMfa() {
    if (!factor) return;
    setDisabling(true);
    try {
      const { error } = await createClient().auth.mfa.unenroll({ factorId: factor.id });
      if (error) throw error;
      setFactor(null);
      toast({ title: 'Verificação em duas etapas desativada' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Não foi possível desativar', description: err?.message });
    } finally { setDisabling(false); }
  }

  async function copySecret() {
    if (!enroll) return;
    try { await navigator.clipboard.writeText(enroll.secret); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* sem permissão */ }
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-6 xl:flex-row xl:items-start">
      <div className="flex min-w-0 flex-1 flex-col gap-6">
        <section className={cn(CARD, 'flex flex-col gap-[22px] px-[30px] py-7')}>
          <CardTitle title="Perfil" />
          <div className="flex items-center gap-5">
            <div className="flex h-[84px] w-[84px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#0F3D2B] text-[28px] font-semibold text-[#96F63C]">
              {photoUrl ? <img src={photoUrl} alt="" className="h-full w-full object-cover" /> : initialsOf(profile.name)}
            </div>
            <div className="flex flex-col gap-2">
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadPhoto} className="hidden" />
              <Button variant="secondary" className="h-10 self-start px-[22px] text-sm" onClick={() => fileRef.current?.click()} disabled={uploadingPhoto}>
                {uploadingPhoto && <Loader2 className="h-4 w-4 animate-spin" />} Trocar foto
              </Button>
              <p className="text-[13px] text-muted-foreground">JPG, PNG ou WebP, até 5 MB</p>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <FieldLabel htmlFor="cfg-name">Nome</FieldLabel>
            <input id="cfg-name" className={FIELD} value={profile.name} onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))} />
          </div>
          <div className="flex flex-col gap-2">
            <FieldLabel htmlFor="cfg-email">Email</FieldLabel>
            <input id="cfg-email" className={FIELD} value={profile.email} disabled />
            <p className="text-[13px] text-muted-foreground">O email de acesso não pode ser alterado por aqui.</p>
          </div>
          <div className="flex flex-col gap-2">
            <FieldLabel htmlFor="cfg-role">Cargo</FieldLabel>
            <input id="cfg-role" className={FIELD} value={profile.department} placeholder="Ex.: Gerente de vendas" onChange={(e) => setProfile((p) => ({ ...p, department: e.target.value }))} />
          </div>
          <div className="flex flex-col gap-2">
            <FieldLabel htmlFor="cfg-bio" optional>Sobre você</FieldLabel>
            <textarea id="cfg-bio" rows={3} className={cn(FIELD, 'h-auto min-h-[84px] resize-none py-3.5 leading-[18px]')} placeholder="Conte um pouco sobre você" value={profile.description} onChange={(e) => setProfile((p) => ({ ...p, description: e.target.value }))} />
          </div>
          <Button className="h-[46px] self-start px-[30px] text-[15px]" onClick={saveProfile} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Salvar alterações
          </Button>
        </section>

        <section className={cn(CARD, 'flex flex-col gap-5 px-[30px] py-7')}>
          <CardTitle title="Preferências" />
          <div className="flex flex-col gap-2.5">
            <p className="text-sm font-semibold text-foreground">Tema</p>
            <div className="flex gap-3" role="radiogroup" aria-label="Tema">
              {([['dark', 'Escuro'], ['light', 'Claro']] as const).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={theme === id}
                  onClick={() => chooseTheme(id)}
                  className={cn('h-12 flex-1 rounded-xl border text-[14.5px] transition-colors', theme === id ? 'border-[#1E6B47] bg-accent font-semibold text-foreground' : 'border-border bg-muted text-muted-foreground hover:text-foreground')}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between gap-5 rounded-xl border border-border bg-muted px-[18px] py-4">
            <div className="flex flex-col gap-1">
              <p className="text-[15px] font-semibold leading-[18px] text-foreground">Som de notificações</p>
              <p className="text-[13.5px] leading-[1.45] text-muted-foreground">Toca um som quando chega mensagem nova no Atendimento.</p>
            </div>
            <Switch checked={notifSound} onCheckedChange={changeSound} aria-label="Som de notificações" className="shrink-0" />
          </div>
        </section>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-6">
        <section className={cn(CARD, 'flex flex-col gap-5 px-[30px] py-7')}>
          <CardTitle title="Senha" hint="Use pelo menos 6 caracteres." />
          {([['current', 'Senha atual'], ['next', 'Nova senha'], ['confirm', 'Confirmar nova senha']] as const).map(([key, label]) => (
            <div key={key} className="flex flex-col gap-2">
              <FieldLabel htmlFor={`cfg-pw-${key}`}>{label}</FieldLabel>
              <input
                id={`cfg-pw-${key}`}
                type="password"
                autoComplete={key === 'current' ? 'current-password' : 'new-password'}
                placeholder="••••••••"
                className={FIELD}
                value={pw[key]}
                onChange={(e) => setPw((p) => ({ ...p, [key]: e.target.value }))}
                onKeyDown={(e) => { if (key === 'confirm' && e.key === 'Enter') changePassword(); }}
              />
            </div>
          ))}
          <Button variant="secondary" className="h-[46px] self-start px-[30px] text-[15px]" onClick={changePassword} disabled={changingPw || !pw.current || !pw.next || !pw.confirm}>
            {changingPw && <Loader2 className="h-4 w-4 animate-spin" />} Alterar senha
          </Button>
        </section>

        <section className={cn(CARD, 'flex flex-col gap-[18px] px-[30px] py-7')}>
          <div className="flex items-start justify-between gap-4">
            <CardTitle title="Verificação em duas etapas" hint="Além da senha, o login pede um código do app autenticador." />
            {!mfaLoading && <StatusPill tone={factor ? 'ok' : 'off'}>{factor ? 'Ativada' : 'Desativada'}</StatusPill>}
          </div>

          {mfaLoading ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</p>
          ) : factor ? (
            <>
              <div className="flex items-start gap-3 rounded-xl border border-green-500/30 bg-green-500/[0.08] px-4 py-3.5">
                <CheckCircle2 className="mt-px h-[18px] w-[18px] shrink-0 text-green-600 dark:text-green-400" />
                <p className="text-sm leading-normal text-green-800 dark:text-green-200/90">Conta protegida. Um código do app autenticador é pedido em cada login.</p>
              </div>
              <Button variant="secondary" className="h-[46px] self-start px-[30px] text-[15px] text-red-600 dark:text-red-400" onClick={disableMfa} disabled={disabling}>
                {disabling && <Loader2 className="h-4 w-4 animate-spin" />} Desativar verificação
              </Button>
            </>
          ) : enroll ? (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-2.5">
                <p className="text-sm font-semibold text-foreground">1. Escaneie o QR code</p>
                <p className="text-sm text-muted-foreground">Abra o Google Authenticator, Authy ou 1Password e escaneie.</p>
                <div className="flex flex-col items-center gap-3">
                  <div className="inline-block rounded-2xl border border-border bg-white p-4"><img src={enroll.qr_code} alt="QR code da verificação em duas etapas" width={180} height={180} /></div>
                  <div className="w-full">
                    <p className="mb-1.5 text-center text-[13px] text-muted-foreground">Ou digite a chave</p>
                    <div className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2.5">
                      <code className="flex-1 select-all break-all text-center font-mono text-[12px] tracking-widest">{enroll.secret}</code>
                      <button type="button" onClick={copySecret} aria-label="Copiar chave" className="rounded-md p-1 text-muted-foreground hover:bg-card hover:text-foreground">
                        {copied ? <CheckCheck className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2.5 border-t border-border pt-5">
                <p className="text-sm font-semibold text-foreground">2. Confirme o código</p>
                <div className="flex gap-2">
                  <input
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="000000"
                    aria-label="Código de 6 dígitos"
                    value={code}
                    autoFocus
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    onKeyDown={(e) => { if (e.key === 'Enter') verifyMfa(); }}
                    className={cn(FIELD, 'h-12 flex-1 text-center font-mono text-xl tracking-[0.4em]')}
                  />
                  <Button className="h-12 px-6" onClick={verifyMfa} disabled={verifying || code.length < 6}>
                    {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Ativar'}
                  </Button>
                </div>
              </div>
              <button type="button" className="self-start text-sm text-muted-foreground underline-offset-4 hover:underline" onClick={() => { setEnroll(null); setCode(''); }}>Cancelar</button>
            </div>
          ) : (
            <>
              <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/[0.08] px-4 py-3.5">
                <AlertTriangle className="mt-px h-[18px] w-[18px] shrink-0 text-amber-600 dark:text-[#F5B544]" />
                <p className="text-sm leading-normal text-amber-900 dark:text-[#D9C28A]">Você ainda não ativou. Ela protege a conta, que guarda as conversas e os dados dos seus leads.</p>
              </div>
              <Button className="h-[46px] self-start px-[30px] text-[15px]" onClick={startMfa} disabled={enrolling}>
                {enrolling && <Loader2 className="h-4 w-4 animate-spin" />} Ativar verificação
              </Button>
              <p className="text-[13px] text-muted-foreground">Funciona com Google Authenticator, Authy e 1Password.</p>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
