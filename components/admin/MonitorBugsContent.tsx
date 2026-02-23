'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Bug, CheckCircle, Clock, AlertCircle, Eye } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from '@/components/ui/use-toast';
import { useRouter } from 'next/navigation';

interface BugData {
  id: string;
  titulo: string;
  descricao: string;
  status: 'aberto' | 'em_analise' | 'resolvido' | 'fechado';
  prioridade: 'baixa' | 'media' | 'alta' | 'critica';
  tipo: 'bug' | 'feature' | 'melhoria' | 'outro';
  created_at: string;
  company?: { name: string };
  user?: { name: string; email: string };
  resolvido_por?: { name: string };
  resolucao?: string;
  url_pagina?: string;
  navegador?: string;
}

interface MonitorBugsContentProps {
  bugs: BugData[];
  stats: {
    total: number;
    abertos: number;
    resolvidos: number;
    emAnalise: number;
  };
}

export function MonitorBugsContent({ bugs: initialBugs, stats }: MonitorBugsContentProps) {
  const router = useRouter();
  const [selectedBug, setSelectedBug] = useState<BugData | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [resolucao, setResolucao] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [filter, setFilter] = useState<string>('todos');

  const statusColors = {
    aberto: 'bg-red-500',
    em_analise: 'bg-yellow-500',
    resolvido: 'bg-green-500',
    fechado: 'bg-gray-500',
  };

  const prioridadeColors = {
    baixa: 'bg-blue-500',
    media: 'bg-yellow-500',
    alta: 'bg-orange-500',
    critica: 'bg-red-500',
  };

  const statusLabels = {
    aberto: 'Aberto',
    em_analise: 'Em Análise',
    resolvido: 'Resolvido',
    fechado: 'Fechado',
  };

  const prioridadeLabels = {
    baixa: 'Baixa',
    media: 'Média',
    alta: 'Alta',
    critica: 'Crítica',
  };

  const handleViewBug = (bug: BugData) => {
    setSelectedBug(bug);
    setStatus(bug.status);
    setResolucao(bug.resolucao || '');
    setIsDialogOpen(true);
  };

  const handleUpdateBug = async () => {
    if (!selectedBug) return;

    setIsUpdating(true);
    try {
      const supabase = createClient();

      // Pegar o admin logado
      const { data: { user } } = await supabase.auth.getUser();
      const { data: adminUser } = await supabase
        .from('admin_users')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      const updateData: any = {
        status,
        resolucao,
        updated_at: new Date().toISOString(),
      };

      if (status === 'resolvido' && adminUser) {
        updateData.resolvido_por_id = adminUser.id;
        updateData.resolvido_em = new Date().toISOString();
      }

      await supabase
        .from('system_bugs')
        .update(updateData)
        .eq('id', selectedBug.id);

      toast({ title: 'Bug atualizado com sucesso!' });
      setIsDialogOpen(false);
      router.refresh();
    } catch (error) {
      toast({ title: 'Erro ao atualizar bug', variant: 'destructive' });
      console.error(error);
    } finally {
      setIsUpdating(false);
    }
  };

  const filteredBugs = filter === 'todos'
    ? initialBugs
    : initialBugs.filter(bug => bug.status === filter);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Monitor de Bugs</h1>
        <p className="text-muted-foreground">
          Gerencie bugs e problemas reportados pelos usuários
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total de Bugs</p>
              <p className="text-3xl font-bold">{stats.total}</p>
            </div>
            <Bug className="h-8 w-8 text-muted-foreground" />
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Abertos</p>
              <p className="text-3xl font-bold text-red-500">{stats.abertos}</p>
            </div>
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Em Análise</p>
              <p className="text-3xl font-bold text-yellow-500">{stats.emAnalise}</p>
            </div>
            <Clock className="h-8 w-8 text-yellow-500" />
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Resolvidos</p>
              <p className="text-3xl font-bold text-green-500">{stats.resolvidos}</p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-500" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <Button
          variant={filter === 'todos' ? 'default' : 'outline'}
          onClick={() => setFilter('todos')}
        >
          Todos
        </Button>
        <Button
          variant={filter === 'aberto' ? 'default' : 'outline'}
          onClick={() => setFilter('aberto')}
        >
          Abertos
        </Button>
        <Button
          variant={filter === 'em_analise' ? 'default' : 'outline'}
          onClick={() => setFilter('em_analise')}
        >
          Em Análise
        </Button>
        <Button
          variant={filter === 'resolvido' ? 'default' : 'outline'}
          onClick={() => setFilter('resolvido')}
        >
          Resolvidos
        </Button>
      </div>

      {/* Bugs Table */}
      <div className="bg-card border border-border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Título</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead>Usuário</TableHead>
              <TableHead>Prioridade</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredBugs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Nenhum bug encontrado
                </TableCell>
              </TableRow>
            ) : (
              filteredBugs.map((bug) => (
                <TableRow key={bug.id}>
                  <TableCell className="font-medium">{bug.titulo}</TableCell>
                  <TableCell>{bug.company?.name || '-'}</TableCell>
                  <TableCell>{bug.user?.name || '-'}</TableCell>
                  <TableCell>
                    <Badge className={prioridadeColors[bug.prioridade]}>
                      {prioridadeLabels[bug.prioridade]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColors[bug.status]}>
                      {statusLabels[bug.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(bug.created_at).toLocaleDateString('pt-BR')}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleViewBug(bug)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Bug Details Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedBug?.titulo}</DialogTitle>
            <DialogDescription>
              Reportado em {selectedBug && new Date(selectedBug.created_at).toLocaleDateString('pt-BR')}
            </DialogDescription>
          </DialogHeader>

          {selectedBug && (
            <div className="space-y-4">
              <div>
                <Label>Descrição</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedBug.descricao}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Empresa</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedBug.company?.name || '-'}
                  </p>
                </div>
                <div>
                  <Label>Usuário</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedBug.user?.name || '-'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Prioridade</Label>
                  <Badge className={`${prioridadeColors[selectedBug.prioridade]} mt-1`}>
                    {prioridadeLabels[selectedBug.prioridade]}
                  </Badge>
                </div>
                <div>
                  <Label>Navegador</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedBug.navegador || '-'}
                  </p>
                </div>
              </div>

              {selectedBug.url_pagina && (
                <div>
                  <Label>URL da Página</Label>
                  <p className="text-sm text-muted-foreground mt-1 break-all">
                    {selectedBug.url_pagina}
                  </p>
                </div>
              )}

              <div>
                <Label htmlFor="status">Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aberto">Aberto</SelectItem>
                    <SelectItem value="em_analise">Em Análise</SelectItem>
                    <SelectItem value="resolvido">Resolvido</SelectItem>
                    <SelectItem value="fechado">Fechado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="resolucao">Resolução</Label>
                <Textarea
                  id="resolucao"
                  value={resolucao}
                  onChange={(e) => setResolucao(e.target.value)}
                  placeholder="Descreva como o bug foi resolvido..."
                  className="mt-1"
                  rows={4}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={isUpdating}
            >
              Cancelar
            </Button>
            <Button onClick={handleUpdateBug} disabled={isUpdating}>
              {isUpdating ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
