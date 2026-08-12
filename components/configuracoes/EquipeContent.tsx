'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { Loader2, Plus, Users, Crown, Eye, Headphones, X, UserX, MoreHorizontal, Hash } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Attendant {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'supervisor' | 'atendente';
  active: boolean;
  online: boolean;
  created_at: string;
}

const ROLE_CONFIG = {
  admin:      { label: 'Admin',      icon: Crown,       color: 'bg-amber-500/15 text-amber-400 ring-amber-500/20' },
  supervisor: { label: 'Supervisor', icon: Eye,         color: 'bg-blue-500/15 text-blue-400 ring-blue-500/20' },
  atendente:  { label: 'Atendente',  icon: Headphones,  color: 'bg-muted text-muted-foreground ring-border' },
};

const ROLE_OPTIONS = ['atendente', 'supervisor', 'admin'] as const;

export function EquipeContent() {
  const [attendants, setAttendants] = useState<Attendant[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [deactivating, setDeactivating] = useState<string | null>(null);
  const [updatingRole, setUpdatingRole] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', email: '', role: 'atendente' as Attendant['role'] });
  const [saving, setSaving] = useState(false);
  const [limits, setLimits] = useState<Record<string, number>>({});
  const [editingLimit, setEditingLimit] = useState<string | null>(null);
  const [limitDraft, setLimitDraft] = useState('15');

  useEffect(() => {
    fetch('/api/attendants')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.data) setAttendants(d.data); })
      .catch(() => {})
      .finally(() => setLoading(false));

    fetch('/api/attendant-limits')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.data) {
          const map: Record<string, number> = {};
          for (const l of d.data) map[l.attendant_id] = l.max_concurrent_conversations;
          setLimits(map);
        }
      })
      .catch(() => {});
  }, []);

  const handleSaveLimit = async (attendantId: string) => {
    const val = parseInt(limitDraft, 10);
    if (isNaN(val) || val < 1) return;
    try {
      const res = await fetch('/api/attendant-limits', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attendant_id: attendantId, max_concurrent_conversations: val }),
      });
      if (!res.ok) {
        const d = await res.json();
        if (d?.migration_pending) {
          toast({ title: 'Execute a migration para usar limites por atendente', variant: 'destructive' });
          return;
        }
      }
      setLimits(prev => ({ ...prev, [attendantId]: val }));
      setEditingLimit(null);
      toast({ title: 'Limite atualizado' });
    } catch {
      toast({ title: 'Erro ao atualizar limite', variant: 'destructive' });
    }
  };

  const handleAdd = async () => {
    if (!form.name.trim() || !form.email.trim()) {
      toast({ title: 'Nome e email são obrigatórios', variant: 'destructive' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      toast({ title: 'Email inválido', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/attendants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setAttendants(prev => [...prev, d.data]);
      setForm({ name: '', email: '', role: 'atendente' });
      setAddOpen(false);
      toast({ title: `${d.data.name} adicionado como ${ROLE_CONFIG[form.role].label}!` });
    } catch (err: any) {
      toast({ title: err.message || 'Erro ao adicionar', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleChangeRole = async (id: string, role: Attendant['role']) => {
    setUpdatingRole(id);
    try {
      const res = await fetch(`/api/attendants/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) throw new Error();
      setAttendants(prev => prev.map(a => a.id === id ? { ...a, role } : a));
      setOpenMenuId(null);
      toast({ title: `Papel alterado para ${ROLE_CONFIG[role].label}` });
    } catch {
      toast({ title: 'Erro ao alterar papel', variant: 'destructive' });
    } finally {
      setUpdatingRole(null);
    }
  };

  const handleDeactivate = async (id: string, name: string) => {
    setDeactivating(id);
    try {
      const res = await fetch(`/api/attendants/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setAttendants(prev => prev.map(a => a.id === id ? { ...a, active: false } : a));
      setOpenMenuId(null);
      toast({ title: `${name} desativado` });
    } catch {
      toast({ title: 'Erro ao desativar', variant: 'destructive' });
    } finally {
      setDeactivating(null);
    }
  };

  const handleReactivate = async (id: string, name: string) => {
    try {
      const res = await fetch(`/api/attendants/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: true }),
      });
      if (!res.ok) throw new Error();
      setAttendants(prev => prev.map(a => a.id === id ? { ...a, active: true } : a));
      toast({ title: `${name} reativado` });
    } catch {
      toast({ title: 'Erro ao reativar', variant: 'destructive' });
    }
  };

  const active = attendants.filter(a => a.active);
  const inactive = attendants.filter(a => !a.active);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {active.length} atendente{active.length !== 1 ? 's' : ''} ativo{active.length !== 1 ? 's' : ''}
        </p>
        <Button size="sm" onClick={() => setAddOpen(o => !o)}>
          <Plus className="h-4 w-4 mr-1.5" />
          Adicionar atendente
        </Button>
      </div>

      {/* Formulário novo atendente */}
      {addOpen && (
        <div className="p-5 rounded-2xl border border-primary/30 bg-primary/5 space-y-3">
          <p className="text-sm font-semibold">Novo atendente</p>
          <div className="grid gap-2">
            <div>
              <Label className="text-xs">Nome</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nome completo" className="h-9 mt-1 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Email</Label>
              <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@empresa.com" className="h-9 mt-1 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Papel</Label>
              <div className="flex gap-2 mt-1">
                {ROLE_OPTIONS.map(r => (
                  <button
                    key={r}
                    onClick={() => setForm(f => ({ ...f, role: r }))}
                    className={cn(
                      'flex-1 h-9 rounded-lg border text-xs font-medium transition-colors',
                      form.role === r
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:border-foreground/30'
                    )}
                  >
                    {ROLE_CONFIG[r].label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={() => setAddOpen(false)} className="text-muted-foreground">Cancelar</Button>
            <Button size="sm" onClick={handleAdd} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Adicionar'}
            </Button>
          </div>
        </div>
      )}

      {/* Lista de atendentes */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : attendants.length === 0 ? (
        <div className="p-8 rounded-2xl border border-dashed border-border flex flex-col items-center gap-3 text-center">
          <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
            <Users className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium text-sm">Nenhum atendente cadastrado</p>
            <p className="text-xs text-muted-foreground mt-1">Adicione sua equipe para atribuir conversas</p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {active.map(att => {
            const rc = ROLE_CONFIG[att.role];
            const RoleIcon = rc.icon;
            return (
              <div key={att.id} className="p-4 rounded-2xl border border-border bg-card flex items-center gap-3">
                {/* Avatar */}
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-sm font-semibold text-primary">
                  {att.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm truncate">{att.name}</p>
                    {att.online && <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" title="Online" />}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{att.email}</p>
                </div>

                {/* Papel badge */}
                <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ring-1 shrink-0', rc.color)}>
                  <RoleIcon className="h-3 w-3" />
                  {rc.label}
                </span>

                {/* Limite de conversas */}
                <div className="shrink-0 flex items-center gap-1">
                  {editingLimit === att.id ? (
                    <>
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        value={limitDraft}
                        onChange={e => setLimitDraft(e.target.value)}
                        className="h-7 w-14 text-xs text-center px-1"
                        autoFocus
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleSaveLimit(att.id);
                          if (e.key === 'Escape') setEditingLimit(null);
                        }}
                      />
                      <button onClick={() => handleSaveLimit(att.id)} className="text-emerald-400 hover:text-emerald-300 transition-colors">
                        <X className="h-3.5 w-3.5 rotate-45" />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => { setEditingLimit(att.id); setLimitDraft(String(limits[att.id] ?? 15)); }}
                      className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-lg hover:bg-muted"
                      title="Limite máximo de conversas simultâneas"
                    >
                      <Hash className="h-3 w-3" />
                      {limits[att.id] ?? 15}
                    </button>
                  )}
                </div>

                {/* Menu */}
                <div className="relative shrink-0">
                  <button
                    onClick={() => setOpenMenuId(openMenuId === att.id ? null : att.id)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>

                  {openMenuId === att.id && (
                    <div className="absolute right-0 top-full mt-1 z-30 bg-card border border-border rounded-xl shadow-xl min-w-[170px] py-1 overflow-hidden">
                      <p className="px-3 py-1.5 text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Alterar papel</p>
                      {ROLE_OPTIONS.filter(r => r !== att.role).map(r => (
                        <button
                          key={r}
                          onClick={() => handleChangeRole(att.id, r)}
                          disabled={updatingRole === att.id}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-accent transition-colors text-left"
                        >
                          {updatingRole === att.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                          {ROLE_CONFIG[r].label}
                        </button>
                      ))}
                      <div className="border-t border-border/60 my-1" />
                      <button
                        onClick={() => handleDeactivate(att.id, att.name)}
                        disabled={deactivating === att.id}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors text-left"
                      >
                        {deactivating === att.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserX className="h-3.5 w-3.5" />}
                        Desativar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Inativos */}
          {inactive.length > 0 && (
            <div className="pt-2">
              <p className="text-xs text-muted-foreground px-1 mb-2">Inativos ({inactive.length})</p>
              {inactive.map(att => (
                <div key={att.id} className="p-3 rounded-2xl border border-border/50 bg-muted/30 flex items-center gap-3 opacity-60 mb-2">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 text-xs font-semibold text-muted-foreground">
                    {att.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm line-through truncate">{att.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{att.email}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleReactivate(att.id, att.name)} className="h-7 text-xs shrink-0">
                    Reativar
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Info sobre login */}
      <div className="p-4 rounded-2xl border border-border/50 bg-muted/30 text-xs text-muted-foreground space-y-1">
        <p className="font-medium text-foreground/70">Sobre o login de atendentes</p>
        <p>Atendentes precisam de uma conta Zaapply com o mesmo email cadastrado aqui. O login individual por atendente está na roadmap — por ora, todos os atendentes usam o login da empresa.</p>
      </div>
    </div>
  );
}
