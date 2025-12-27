'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { formatDateTime } from '@/lib/utils/format';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export default function UsuariosPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCompany, setFilterCompany] = useState('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: '',
    company_id: '',
    department: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [usersRes, companiesRes] = await Promise.all([
        fetch('/api/admin/users'),
        fetch('/api/admin/companies'),
      ]);

      const usersData = await usersRes.json();
      const companiesData = await companiesRes.json();

      setUsers(usersData.data || []);
      setCompanies(companiesData.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateUser() {
    if (!newUser.name || !newUser.email || !newUser.password || !newUser.company_id) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    setCreating(true);
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.message);

      toast.success('Usuário criado com sucesso!');
      setIsDialogOpen(false);
      setNewUser({ name: '', email: '', password: '', company_id: '', department: '' });
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao criar usuário');
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteUser(userId: number, userName: string) {
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.message);

      toast.success(`Usuário ${userName} deletado com sucesso!`);
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao deletar usuário');
    }
  }

  const filteredUsers = filterCompany === 'all'
    ? users
    : users.filter(u => u.company_id === parseInt(filterCompany));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Usuários</h1>
          <p className="text-muted-foreground mt-1">Gerencie os usuários do sistema</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              Adicionar Usuário
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Novo Usuário</DialogTitle>
              <DialogDescription>
                Adicione um novo usuário a uma empresa
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome *</Label>
                <Input
                  id="name"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  placeholder="João Silva"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  placeholder="joao@empresa.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha Temporária *</Label>
                <Input
                  id="password"
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  placeholder="Senha@123"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company">Empresa *</Label>
                <Select value={newUser.company_id} onValueChange={(value) => setNewUser({ ...newUser, company_id: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((company) => (
                      <SelectItem key={company.id} value={company.id.toString()}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="department">Cargo</Label>
                <Input
                  id="department"
                  value={newUser.department}
                  onChange={(e) => setNewUser({ ...newUser, department: e.target.value })}
                  placeholder="Vendedor, Gerente, etc."
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreateUser} disabled={creating}>
                {creating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Criando...
                  </>
                ) : (
                  'Criar Usuário'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle>Todos os Usuários ({filteredUsers.length})</CardTitle>
            <Select value={filterCompany} onValueChange={setFilterCompany}>
              <SelectTrigger className="w-full sm:w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as empresas</SelectItem>
                {companies.map((company) => (
                  <SelectItem key={company.id} value={company.id.toString()}>
                    {company.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">Nenhum usuário encontrado</p>
          ) : (
            <div className="overflow-x-auto -mx-3 md:mx-0">
              <table className="w-full min-w-[800px]">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 md:p-3 text-xs md:text-sm">Nome</th>
                    <th className="text-left p-2 md:p-3 text-xs md:text-sm">Email</th>
                    <th className="text-left p-2 md:p-3 text-xs md:text-sm">Empresa</th>
                    <th className="text-left p-2 md:p-3 text-xs md:text-sm">Cargo</th>
                    <th className="text-left p-2 md:p-3 text-xs md:text-sm">Status</th>
                    <th className="text-left p-2 md:p-3 text-xs md:text-sm">Último Login</th>
                    <th className="text-left p-2 md:p-3 text-xs md:text-sm">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user: any) => (
                    <tr key={user.id} className="border-b hover:bg-accent">
                      <td className="p-2 md:p-3 font-medium text-sm">{user.name}</td>
                      <td className="p-2 md:p-3 text-xs md:text-sm">{user.email}</td>
                      <td className="p-2 md:p-3 text-xs md:text-sm text-muted-foreground">
                        {companies.find(c => c.id === user.company_id)?.name || '-'}
                      </td>
                      <td className="p-2 md:p-3 text-xs md:text-sm">{user.department || '-'}</td>
                      <td className="p-2 md:p-3">
                        {user.is_active ? (
                          <Badge className="bg-green-500 text-xs">Ativo</Badge>
                        ) : (
                          <Badge variant="destructive" className="text-xs">Inativo</Badge>
                        )}
                      </td>
                      <td className="p-2 md:p-3 text-xs text-muted-foreground">
                        {user.last_login ? formatDateTime(user.last_login) : 'Nunca'}
                      </td>
                      <td className="p-2 md:p-3">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <Trash2 className="h-3 w-3 md:h-4 md:w-4 text-red-500" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Deletar Usuário</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja deletar o usuário <strong>{user.name}</strong>?
                                Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteUser(user.id, user.name)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Deletar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
