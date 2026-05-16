'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { UserPlus, Search, Trash2, Edit } from 'lucide-react';
import { useUser } from '@/lib/hooks/useUser';
import { toast } from '@/components/ui/use-toast';
import { SimplePagination } from '@/components/ui/pagination-simple';

interface Member {
  user_id: string;
  name: string;
  email: string;
  role: string;
  department?: string;
  is_active: boolean;
  last_login?: string;
  created_at: string;
}

const ROLE_CONFIG: Record<string, { label: string; className: string }> = {
  admin:      { label: 'Admin',      className: 'bg-purple-500/10 text-purple-600 dark:text-purple-400' },
  manager:    { label: 'Gerente',    className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  sdr:        { label: 'SDR',        className: 'bg-orange-500/10 text-orange-600 dark:text-orange-400' },
  closer:     { label: 'Closer',     className: 'bg-primary/10 text-primary' },
  sdr_closer: { label: 'SDR+Closer', className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
};

function getRoleChip(role: string) {
  const c = ROLE_CONFIG[role] || { label: 'Membro', className: 'bg-muted text-muted-foreground' };
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md whitespace-nowrap ${c.className}`}>
      {c.label}
    </span>
  );
}

function fmtRelative(dateStr?: string): string {
  if (!dateStr) return 'Nunca';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Agora';
  if (mins < 60) return `${mins}min atrás`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h atrás`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Ontem';
  if (days < 7) return `${days} dias atrás`;
  return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function getInitials(name: string): string {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

export default function MembrosPage() {
  const { user, company } = useUser();

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isInviting, setIsInviting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const itemsPerPage = 10;

  const isAdmin = user?.role === 'admin' || user?.role === 'manager';

  const [inviteForm, setInviteForm] = useState({ name: '', email: '', role: 'closer', department: '' });
  const [editForm, setEditForm] = useState({ role: '', department: '' });

  useEffect(() => {
    if (!company?.id) return;
    fetchMembers();
  }, [company?.id]);

  async function fetchMembers() {
    try {
      setLoading(true);
      const response = await fetch(`/api/members?companyId=${company!.id}`);
      const data = await response.json();
      if (!data.success) throw new Error(data.message);
      setMembers(data.data || []);
    } catch {
      toast({ title: 'Erro ao carregar membros', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  async function handleInviteMember(e: React.FormEvent) {
    e.preventDefault();
    setIsInviting(true);
    try {
      const response = await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...inviteForm, companyId: company!.id }),
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.message);
      toast({ title: 'Convite enviado! Verifique o email (inclusive spam).' });
      setInviteDialogOpen(false);
      setInviteForm({ name: '', email: '', role: 'closer', department: '' });
      fetchMembers();
    } catch (error: any) {
      toast({ title: error.message || 'Erro ao convidar membro', variant: 'destructive' });
    } finally {
      setIsInviting(false);
    }
  }

  async function handleEditMember(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedMember) return;
    try {
      const response = await fetch(`/api/members/${selectedMember.user_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...editForm, companyId: company!.id }),
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.message);
      toast({ title: 'Membro atualizado com sucesso!' });
      setEditDialogOpen(false);
      setSelectedMember(null);
      fetchMembers();
    } catch (error: any) {
      toast({ title: error.message || 'Erro ao atualizar membro', variant: 'destructive' });
    }
  }

  async function handleDeleteMember() {
    if (!selectedMember) return;
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/members/${selectedMember.user_id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: company!.id }),
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.message);
      toast({ title: 'Membro removido com sucesso!' });
      setDeleteDialogOpen(false);
      setSelectedMember(null);
      fetchMembers();
    } catch (error: any) {
      toast({ title: error.message || 'Erro ao remover membro', variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  }

  function openEditDialog(member: Member) {
    setSelectedMember(member);
    setEditForm({ role: member.role, department: member.department || '' });
    setEditDialogOpen(true);
  }

  function openDeleteDialog(member: Member) {
    setSelectedMember(member);
    setDeleteDialogOpen(true);
  }

  const filteredMembers = members.filter(
    (m) =>
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.department?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPages = Math.ceil(filteredMembers.length / itemsPerPage);
  const paginatedMembers = filteredMembers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  useEffect(() => { setCurrentPage(1); }, [searchQuery]);

  // Stats
  const activeCount = members.filter(m => m.is_active).length;
  const roleCounts = members.reduce<Record<string, number>>((acc, m) => {
    acc[m.role] = (acc[m.role] || 0) + 1;
    return acc;
  }, {});
  const statsText = members.length === 0
    ? 'Gerencie os membros da sua empresa'
    : [
        `${members.length} membros`,
        `${activeCount} ativos`,
        roleCounts.admin     && `${roleCounts.admin} admin${roleCounts.admin > 1 ? 's' : ''}`,
        roleCounts.manager   && `${roleCounts.manager} gerente${roleCounts.manager > 1 ? 's' : ''}`,
        roleCounts.closer    && `${roleCounts.closer} closer${roleCounts.closer > 1 ? 's' : ''}`,
        roleCounts.sdr       && `${roleCounts.sdr} SDR${roleCounts.sdr > 1 ? 's' : ''}`,
        roleCounts.sdr_closer && `${roleCounts.sdr_closer} SDR+Closer`,
      ].filter(Boolean).join(' · ');

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="h-14 bg-muted/50 animate-pulse rounded-xl" />
        <div className="h-9 bg-muted/30 animate-pulse rounded-xl max-w-xs" />
        <div className="rounded-xl border border-border/50 overflow-hidden space-y-px">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-[60px] bg-muted/20 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Page Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Membros</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{statsText}</p>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={() => setInviteDialogOpen(true)} className="gap-1.5 flex-shrink-0">
            <UserPlus className="h-3.5 w-3.5" />
            Convidar
          </Button>
        )}
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, email ou departamento..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
        {searchQuery && (
          <span className="text-xs text-muted-foreground">
            {filteredMembers.length} de {members.length}
          </span>
        )}
      </div>

      {/* Members table */}
      <div className="rounded-xl border border-border/50 overflow-hidden">
        {/* Table header */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/30 border-b border-border/50">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Membro
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Função
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">
                  Departamento
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">
                  Último acesso
                </th>
                <th className="px-4 py-2.5 w-20" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 bg-card">
              {paginatedMembers.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <div className="flex flex-col items-center justify-center py-16 gap-4">
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                        <UserPlus className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-medium text-foreground">
                          {searchQuery ? 'Nenhum membro encontrado' : 'Nenhum membro ainda'}
                        </p>
                        {isAdmin && !searchQuery && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Convide o primeiro membro da equipe
                          </p>
                        )}
                      </div>
                      {isAdmin && !searchQuery && (
                        <Button size="sm" onClick={() => setInviteDialogOpen(true)} className="gap-1.5">
                          <UserPlus className="h-3.5 w-3.5" />
                          Convidar Membro
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedMembers.map((member) => (
                  <tr key={member.user_id} className="hover:bg-accent/30 transition-colors">
                    {/* Member */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="relative flex-shrink-0">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs font-medium bg-primary/10 text-primary">
                              {getInitials(member.name)}
                            </AvatarFallback>
                          </Avatar>
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-background ${
                              member.is_active ? 'bg-emerald-500' : 'bg-muted-foreground/30'
                            }`}
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{member.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="px-4 py-3">{getRoleChip(member.role)}</td>

                    {/* Department */}
                    <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell">
                      {member.department || '—'}
                    </td>

                    {/* Last login */}
                    <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell tabular-nums">
                      {fmtRelative(member.last_login)}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      {isAdmin && member.user_id !== user?.user_id && (
                        <div className="flex items-center gap-1 justify-end">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 hover:bg-accent"
                            onClick={() => openEditDialog(member)}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-accent"
                            onClick={() => openDeleteDialog(member)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {filteredMembers.length > itemsPerPage && (
        <SimplePagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          totalItems={filteredMembers.length}
          itemsPerPage={itemsPerPage}
        />
      )}

      {/* Invite Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Convidar Membro</DialogTitle>
            <DialogDescription>
              O convite será enviado por email. Verifique também a caixa de spam.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleInviteMember}>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="name">Nome completo</Label>
                <Input
                  id="name"
                  value={inviteForm.name}
                  onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
                  placeholder="João Silva"
                  required
                  className="h-9"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  placeholder="joao@empresa.com"
                  required
                  className="h-9"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Função</Label>
                  <Select value={inviteForm.role} onValueChange={(v) => setInviteForm({ ...inviteForm, role: v })}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sdr">SDR</SelectItem>
                      <SelectItem value="closer">Closer</SelectItem>
                      <SelectItem value="sdr_closer">SDR+Closer</SelectItem>
                      <SelectItem value="manager">Gerente</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="department">Departamento</Label>
                  <Input
                    id="department"
                    value={inviteForm.department}
                    onChange={(e) => setInviteForm({ ...inviteForm, department: e.target.value })}
                    placeholder="Vendas"
                    className="h-9"
                  />
                </div>
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" size="sm" onClick={() => setInviteDialogOpen(false)} disabled={isInviting}>
                Cancelar
              </Button>
              <Button type="submit" size="sm" disabled={isInviting}>
                {isInviting ? 'Enviando…' : 'Enviar Convite'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Editar {selectedMember?.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditMember}>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Função</Label>
                <Select value={editForm.role} onValueChange={(v) => setEditForm({ ...editForm, role: v })}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sdr">SDR</SelectItem>
                    <SelectItem value="closer">Closer</SelectItem>
                    <SelectItem value="sdr_closer">SDR+Closer</SelectItem>
                    <SelectItem value="manager">Gerente</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Departamento</Label>
                <Input
                  value={editForm.department}
                  onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                  placeholder="Vendas"
                  className="h-9"
                />
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" size="sm" onClick={() => setEditDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" size="sm">Salvar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover membro</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover <strong>{selectedMember?.name}</strong>?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteMember}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting ? 'Removendo…' : 'Remover'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
