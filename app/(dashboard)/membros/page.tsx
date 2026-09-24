'use client';

import { useEffect, useMemo, useState } from 'react';
import { Clock, Info, Loader2, Plus, Search, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUser } from '@/lib/hooks/useUser';
import { toast } from '@/components/ui/use-toast';
import { SimplePagination } from '@/components/ui/pagination-simple';
import { cn } from '@/lib/utils';
import { CARD, CardTitle, FIELD, FieldLabel } from '@/components/configuracoes/cfg-ui';

interface Member {
  user_id: string;
  name: string;
  email: string;
  role: string;
  department?: string | null;
  is_active: boolean;
  last_login?: string | null;
  created_at: string;
}

const ROLES = [
  { value: 'sdr', label: 'Pré-vendas', desc: 'Faz a primeira conversa e qualifica o lead', chip: 'bg-orange-500/15 text-orange-700 dark:text-orange-300' },
  { value: 'closer', label: 'Closer', desc: 'Conduz a reunião e fecha a venda', chip: 'bg-[#01573C]/15 text-[#01573C] dark:bg-[#96F63C]/15 dark:text-[#96F63C]' },
  { value: 'sdr_closer', label: 'Pré-vendas e Closer', desc: 'Faz as duas etapas', chip: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' },
  { value: 'manager', label: 'Gerente', desc: 'Pode convidar, editar e remover membros', chip: 'bg-blue-500/15 text-blue-700 dark:text-blue-300' },
  { value: 'admin', label: 'Admin', desc: 'Pode convidar, editar e remover membros', chip: 'bg-purple-500/15 text-purple-700 dark:text-purple-300' },
] as const;

const roleOf = (role: string) => ROLES.find((r) => r.value === role) ?? { value: role, label: 'Membro', desc: '', chip: 'bg-muted text-muted-foreground' };

const initials = (name: string) => name.split(/\s+/).filter(Boolean).map((n) => n[0]).join('').toUpperCase().slice(0, 2);

function fmtLast(d?: string | null) {
  if (!d) return 'Sem registro';
  const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (mins < 1) return 'Agora';
  if (mins < 60) return `${mins} min atrás`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} h atrás`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Ontem';
  if (days < 7) return `${days} dias atrás`;
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

const Avatar = ({ name, size = 40, mine }: { name: string; size?: number; mine?: boolean }) => (
  <span
    className={cn('flex shrink-0 items-center justify-center rounded-full font-semibold', mine ? 'bg-[#0F3D2B] text-[#96F63C]' : 'bg-accent text-[#01573C] dark:text-[#96F63C]')}
    style={{ width: size, height: size, fontSize: size * 0.32 }}
  >
    {initials(name)}
  </span>
);

function RoleOptions({ value, onChange, allowAdmin }: { value: string; onChange: (v: string) => void; allowAdmin: boolean }) {
  return (
    <div className="flex flex-col gap-2" role="radiogroup" aria-label="Função">
      {ROLES.filter((r) => allowAdmin || r.value !== 'admin').map((r) => {
        const on = value === r.value;
        return (
          <button
            key={r.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(r.value)}
            className={cn('flex items-center gap-3.5 rounded-xl border px-4 py-3 text-left transition-colors', on ? 'border-[#1E6B47] bg-accent' : 'border-border bg-muted hover:border-foreground/25')}
          >
            <span className={cn('flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2', on ? 'border-[#01573C] dark:border-[#96F63C]' : 'border-muted-foreground/50')}>
              {on && <span className="h-2 w-2 rounded-full bg-[#01573C] dark:bg-[#96F63C]" />}
            </span>
            <span className="flex flex-col gap-px">
              <span className={cn('text-[15px] leading-[18px] text-foreground', on && 'font-semibold')}>{r.label}</span>
              <span className="text-[13.5px] leading-[18px] text-muted-foreground">{r.desc}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default function MembrosPage() {
  const { user, company } = useUser();

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const perPage = 10;

  const myRole: string | undefined = user?.role;
  const canInvite = myRole === 'admin' || myRole === 'manager' || myRole === 'company_admin';
  // Só administrador mexe em outro administrador ou dá esse papel (a API também confere)
  const isAdminRole = myRole === 'admin' || myRole === 'company_admin';
  const canManage = (m: Member) => canInvite && m.user_id !== user?.user_id && (isAdminRole || (m.role !== 'admin' && m.role !== 'company_admin'));

  const [inviteForm, setInviteForm] = useState({ name: '', email: '', role: 'closer', department: '' });
  const [editForm, setEditForm] = useState({ role: '', department: '' });

  async function fetchMembers() {
    try {
      const res = await fetch(`/api/members?companyId=${company!.id}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setMembers(data.data || []);
    } catch {
      toast({ variant: 'destructive', title: 'Não foi possível carregar os membros' });
    } finally { setLoading(false); }
  }

  useEffect(() => { if (company?.id) void fetchMembers(); }, [company?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setPage(1); }, [query]);

  const selected = members.find((m) => m.user_id === selectedId) ?? null;
  useEffect(() => {
    if (selected) setEditForm({ role: selected.role, department: selected.department || '' });
  }, [selected?.user_id]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q) || (m.department ?? '').toLowerCase().includes(q));
  }, [members, query]);
  const pageRows = filtered.slice((page - 1) * perPage, page * perPage);

  const active = members.filter((m) => m.is_active).length;
  const count = (r: string) => members.filter((m) => m.role === r).length;
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const summary = members.length === 0
    ? 'Gerencie os membros da sua empresa'
    : [
        plural(active, 'membro ativo', 'membros ativos'),
        count('admin') > 0 && plural(count('admin'), 'admin', 'admins'),
        count('manager') > 0 && plural(count('manager'), 'gerente', 'gerentes'),
        count('closer') > 0 && plural(count('closer'), 'closer', 'closers'),
        count('sdr') > 0 && `${count('sdr')} de pré-vendas`,
        count('sdr_closer') > 0 && `${count('sdr_closer')} de pré-vendas e closer`,
      ].filter(Boolean).join(' · ');
  const noAccessRecorded = members.length > 0 && members.every((m) => !m.last_login);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    try {
      const res = await fetch('/api/members', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...inviteForm, companyId: company!.id }) });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      toast({ variant: 'success', title: 'Convite enviado', description: 'Peça para a pessoa olhar também o spam.' });
      setInviteOpen(false);
      setInviteForm({ name: '', email: '', role: 'closer', department: '' });
      void fetchMembers();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Não foi possível convidar', description: err?.message });
    } finally { setInviting(false); }
  }

  async function saveEdit() {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/members/${selected.user_id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...editForm, companyId: company!.id }) });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      toast({ variant: 'success', title: 'Membro atualizado' });
      void fetchMembers();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Não foi possível salvar', description: err?.message });
    } finally { setSaving(false); }
  }

  async function remove() {
    if (!selected) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/members/${selected.user_id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ companyId: company!.id }) });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      toast({ title: `${selected.name} foi removido` });
      setDeleteOpen(false);
      setSelectedId(null);
      void fetchMembers();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Não foi possível remover', description: err?.message });
    } finally { setDeleting(false); }
  }

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const dirty = !!selected && (editForm.role !== selected.role || editForm.department !== (selected.department || ''));

  return (
    <div className="mx-auto flex w-full max-w-[1900px] flex-col gap-6 pb-14 pt-2">
      <div className="flex flex-wrap items-center justify-between gap-6">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[26px] font-semibold leading-8 tracking-tight text-foreground">Membros</h1>
          <p className="text-[15px] text-muted-foreground">{summary}</p>
        </div>
        {canInvite && <Button className="h-[46px] px-6 text-[15px]" onClick={() => setInviteOpen(true)}><Plus className="!size-4" strokeWidth={2.4} /> Convidar membro</Button>}
      </div>

      {noAccessRecorded && (
        <div className="flex items-start gap-4 rounded-[14px] border border-amber-500/30 bg-amber-500/[0.08] px-6 py-4">
          <Clock className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-[#F5B544]" strokeWidth={2} />
          <div className="flex flex-col gap-0.5">
            <p className="text-base font-semibold text-foreground">O último acesso não está sendo registrado</p>
            <p className="text-sm text-amber-900/80 dark:text-[#D9C28A]">Nenhum dos {members.length} membros tem acesso salvo, então não dá para saber quem entrou no sistema.</p>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
        <section className={cn(CARD, 'flex min-w-0 flex-1 flex-col gap-4 p-[26px]')}>
          <label className="flex h-[46px] items-center gap-3 rounded-xl border border-border bg-muted px-4">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nome, email ou departamento" aria-label="Buscar membro" className="w-full bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground" />
          </label>

          {pageRows.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <p className="text-base font-medium text-foreground">{query ? 'Nenhum membro encontrado' : 'Nenhum membro ainda'}</p>
              {canInvite && !query && <Button className="h-11 px-6" onClick={() => setInviteOpen(true)}>Convidar o primeiro membro</Button>}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse">
                <thead>
                  <tr className="text-left text-[13px] font-medium tracking-[0.06em] text-muted-foreground">
                    <th className="px-4 py-3 font-medium">MEMBRO</th>
                    <th className="px-4 py-3 font-medium">FUNÇÃO</th>
                    <th className="hidden px-4 py-3 font-medium md:table-cell">DEPARTAMENTO</th>
                    <th className="hidden px-4 py-3 font-medium md:table-cell">ÚLTIMO ACESSO</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((m) => {
                    const r = roleOf(m.role);
                    const on = m.user_id === selectedId;
                    const mine = m.user_id === user?.user_id;
                    return (
                      <tr
                        key={m.user_id}
                        onClick={() => setSelectedId(m.user_id)}
                        className={cn('cursor-pointer border-t border-border transition-colors', on ? 'bg-accent' : 'hover:bg-muted')}
                      >
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3.5">
                            <Avatar name={m.name} mine={mine} />
                            <div className="min-w-0">
                              <p className="flex items-center gap-2 text-base font-semibold leading-5 text-foreground">
                                <span className="truncate">{m.name}</span>
                                {mine && <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-normal text-muted-foreground">Você</span>}
                                {!m.is_active && <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-normal text-muted-foreground">Inativo</span>}
                              </p>
                              <p className="truncate text-sm text-muted-foreground">{m.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5"><span className={cn('whitespace-nowrap rounded-full px-3 py-1 text-[13px] font-semibold', r.chip)}>{r.label}</span></td>
                        <td className={cn('hidden px-4 py-3.5 text-[15px] md:table-cell', m.department ? 'text-foreground' : 'text-muted-foreground')}>{m.department || 'Sem departamento'}</td>
                        <td className="hidden px-4 py-3.5 text-[15px] text-muted-foreground md:table-cell">{fmtLast(m.last_login)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {filtered.length > perPage && (
            <SimplePagination currentPage={page} totalPages={Math.ceil(filtered.length / perPage)} onPageChange={setPage} totalItems={filtered.length} itemsPerPage={perPage} />
          )}

          <p className="flex items-center gap-3 rounded-xl border border-border bg-muted px-[18px] py-3.5 text-sm text-muted-foreground">
            <Info className="h-4 w-4 shrink-0" strokeWidth={2} /> Durante o teste não há limite de membros. Depois, cada plano tem um limite de membros ativos.
          </p>
        </section>

        <aside className={cn(CARD, 'flex w-full shrink-0 flex-col gap-5 p-[30px] xl:w-[480px]')}>
          {!selected ? (
            <div className="flex flex-col items-center gap-1.5 py-16 text-center">
              <p className="text-base font-medium text-foreground">Selecione um membro</p>
              <p className="text-sm text-muted-foreground">para ver os detalhes e editar a função.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-4">
                <Avatar name={selected.name} size={56} mine={selected.user_id === user?.user_id} />
                <div className="min-w-0">
                  <p className="truncate text-[22px] font-semibold leading-7 tracking-tight text-foreground">{selected.name}</p>
                  <p className="truncate text-[15px] text-muted-foreground">{selected.email}</p>
                </div>
              </div>

              {canManage(selected) ? (
                <>
                  <div className="flex flex-col gap-2">
                    <FieldLabel>Função</FieldLabel>
                    <Select value={editForm.role} onValueChange={(v) => setEditForm((f) => ({ ...f, role: v }))}>
                      <SelectTrigger className="h-[50px] rounded-xl border-border bg-muted px-4 text-[15px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ROLES.filter((r) => isAdminRole || r.value !== 'admin').map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <p className="text-[13.5px] text-muted-foreground">Gerentes e admins podem convidar, editar e remover membros.</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <FieldLabel htmlFor="mb-dep">Departamento</FieldLabel>
                    <input id="mb-dep" className={FIELD} value={editForm.department} placeholder="Vendas" onChange={(e) => setEditForm((f) => ({ ...f, department: e.target.value }))} />
                  </div>
                </>
              ) : (
                <div className="flex flex-col gap-1 rounded-xl border border-border bg-muted px-[18px] py-3.5">
                  <p className="text-sm text-muted-foreground">Função</p>
                  <p className="text-[15px] font-semibold text-foreground">{roleOf(selected.role).label}</p>
                  <p className="text-[13.5px] text-muted-foreground">{selected.user_id === user?.user_id ? 'Você não pode editar a própria função.' : 'Só um administrador edita esta pessoa.'}</p>
                </div>
              )}

              <dl className="flex flex-col rounded-xl border border-border bg-muted">
                <div className="flex items-center justify-between px-[18px] py-3.5"><dt className="text-[15px] text-muted-foreground">Membro desde</dt><dd className="text-[15px] font-semibold text-foreground">{new Date(selected.created_at).toLocaleDateString('pt-BR')}</dd></div>
                <div className="flex items-center justify-between border-t border-border px-[18px] py-3.5"><dt className="text-[15px] text-muted-foreground">Último acesso</dt><dd className="text-[15px] text-muted-foreground">{fmtLast(selected.last_login)}</dd></div>
              </dl>

              {canManage(selected) && (
                <div className="flex flex-col gap-3">
                  <Button className="h-[50px] text-base" onClick={saveEdit} disabled={saving || !dirty}>{saving && <Loader2 className="h-4 w-4 animate-spin" />} Salvar alterações</Button>
                  <Button variant="secondary" className="h-[50px] text-base text-red-600 dark:text-red-400" onClick={() => setDeleteOpen(true)}>Remover membro</Button>
                </div>
              )}
            </>
          )}
        </aside>
      </div>

      {/* Convidar */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-h-[92vh] max-w-[600px] gap-0 overflow-y-auto rounded-[20px] border-border bg-card p-9 [&>button]:hidden">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1.5">
              <DialogTitle className="text-2xl font-semibold leading-8 tracking-tight">Convidar membro</DialogTitle>
              <DialogDescription className="text-[15px] text-muted-foreground">A pessoa recebe um convite por email. Peça para olhar também o spam.</DialogDescription>
            </div>
            <button type="button" onClick={() => setInviteOpen(false)} aria-label="Fechar" className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><X className="h-5 w-5" /></button>
          </div>
          <form onSubmit={invite} className="mt-6 flex flex-col gap-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2"><FieldLabel htmlFor="iv-name">Nome completo</FieldLabel><input id="iv-name" required className={FIELD} placeholder="João Silva" value={inviteForm.name} onChange={(e) => setInviteForm((f) => ({ ...f, name: e.target.value }))} /></div>
              <div className="flex flex-col gap-2"><FieldLabel htmlFor="iv-email">Email</FieldLabel><input id="iv-email" required type="email" className={FIELD} placeholder="joao@empresa.com" value={inviteForm.email} onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))} /></div>
            </div>
            <div className="flex flex-col gap-2.5">
              <p className="text-sm font-semibold text-foreground">Função</p>
              <RoleOptions value={inviteForm.role} onChange={(v) => setInviteForm((f) => ({ ...f, role: v }))} allowAdmin={isAdminRole} />
            </div>
            <div className="flex flex-col gap-2"><FieldLabel htmlFor="iv-dep" optional>Departamento</FieldLabel><input id="iv-dep" className={FIELD} placeholder="Vendas" value={inviteForm.department} onChange={(e) => setInviteForm((f) => ({ ...f, department: e.target.value }))} /></div>
            <div className="flex justify-end gap-3 pt-1">
              <Button type="button" variant="secondary" className="h-[46px] px-6 text-[15px]" onClick={() => setInviteOpen(false)} disabled={inviting}>Cancelar</Button>
              <Button type="submit" className="h-[46px] px-7 text-[15px]" disabled={inviting}>{inviting && <Loader2 className="h-4 w-4 animate-spin" />} Enviar convite</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Remover */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="max-w-[500px] gap-0 rounded-[20px] border-border bg-card p-8">
          <span className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-red-500/15"><Trash2 className="h-5 w-5 text-red-500" strokeWidth={2} /></span>
          <AlertDialogTitle className="mt-4 text-2xl font-semibold tracking-tight">Remover {selected?.name}?</AlertDialogTitle>
          <AlertDialogDescription className="mt-2 text-[15px] leading-normal text-muted-foreground">Essa pessoa perde o acesso ao Zaapply. Essa ação não pode ser desfeita. Para voltar, será preciso convidar de novo.</AlertDialogDescription>
          {selected && (
            <div className="mt-5 flex items-center gap-3.5 rounded-xl border border-border bg-muted px-[18px] py-3.5">
              <Avatar name={selected.name} size={40} />
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold text-foreground">{selected.name}</p>
                <p className="truncate text-sm text-muted-foreground">{selected.email} · {roleOf(selected.role).label}{selected.department ? ` · ${selected.department}` : ''}</p>
              </div>
            </div>
          )}
          <div className="mt-6 flex justify-end gap-3">
            <Button variant="secondary" className="h-[46px] px-6 text-[15px]" onClick={() => setDeleteOpen(false)} disabled={deleting}>Cancelar</Button>
            <Button variant="destructive" className="h-[46px] px-7 text-[15px] [box-shadow:0_2px_0_0_#7F1D1D]" onClick={remove} disabled={deleting}>{deleting && <Loader2 className="h-4 w-4 animate-spin" />} Remover membro</Button>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
