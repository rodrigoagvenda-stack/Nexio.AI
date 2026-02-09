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
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Server,
  Activity,
  AlertCircle,
  TrendingUp,
  Plus,
  Eye,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  RefreshCw,
  Clock,
  Sparkles,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils/cn';

interface N8NInstance {
  id: string;
  name: string;
  url: string;
  api_key: string;
  check_interval: number;
  active: boolean;
  last_check: string | null;
  created_at: string;
  updated_at: string;
}

interface N8NError {
  id: string;
  instance_id: string;
  execution_id: string;
  workflow_id: string;
  workflow_name: string;
  error_node: string;
  error_message: string;
  error_details: string;
  ai_analysis: string | null;
  severity: 'low' | 'medium' | 'high' | 'critical';
  notified: boolean;
  resolved: boolean;
  timestamp: string;
  created_at: string;
  instance?: {
    id: string;
    name: string;
    url: string;
  };
}

interface N8NMonitorContentProps {
  instances: N8NInstance[];
  errors: N8NError[];
  stats: {
    totalInstances: number;
    errors24h: number;
    uptimeAverage: number;
    activeInstances: number;
  };
}

type DialogMode = 'view-instance' | 'add-instance' | 'edit-instance' | 'view-error' | 'error-history' | null;

export function N8NMonitorContent({ instances: initialInstances, errors: initialErrors, stats }: N8NMonitorContentProps) {
  const router = useRouter();
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [selectedInstance, setSelectedInstance] = useState<N8NInstance | null>(null);
  const [selectedError, setSelectedError] = useState<N8NError | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterResolved, setFilterResolved] = useState<string>('all');
  const [filterWorkflow, setFilterWorkflow] = useState<string>('all');
  const [isSyncing, setIsSyncing] = useState(false);
  const [instancesPage, setInstancesPage] = useState(1);
  const [errorsPage, setErrorsPage] = useState(1);
  const itemsPerPage = 10;

  // Form state para instância
  const [instanceForm, setInstanceForm] = useState({
    name: '',
    url: '',
    api_key: '',
    check_interval: '5',
    active: true,
  });

  // Lista de workflows únicos para o filtro
  const uniqueWorkflows = Array.from(
    new Set(initialErrors.map(e => e.workflow_name).filter(Boolean))
  );

  // Sincronizar erros do n8n
  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch('/api/admin/n8n/sync', { method: 'POST' });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      if (data.newErrors > 0) {
        toast.success(`${data.newErrors} novos erros encontrados!`);
      } else {
        toast.info('Nenhum novo erro encontrado');
      }

      // Sempre recarregar a página para garantir dados atualizados
      setTimeout(() => window.location.reload(), 500);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao sincronizar');
      setIsSyncing(false);
    }
  };

  // Filtrar erros
  const filteredErrors = initialErrors.filter((error) => {
    if (filterResolved === 'resolved' && !error.resolved) return false;
    if (filterResolved === 'unresolved' && error.resolved) return false;
    if (filterSeverity !== 'all' && error.severity !== filterSeverity) return false;
    if (filterWorkflow !== 'all' && error.workflow_name !== filterWorkflow) return false;
    return true;
  });

  // Filtrar instâncias
  const filteredInstances = filterStatus === 'all'
    ? initialInstances
    : initialInstances.filter(i => filterStatus === 'active' ? i.active : !i.active);

  // Paginação de instâncias
  const instancesTotalPages = Math.ceil(filteredInstances.length / itemsPerPage);
  const paginatedInstances = filteredInstances.slice(
    (instancesPage - 1) * itemsPerPage,
    instancesPage * itemsPerPage
  );

  // Paginação de erros
  const errorsTotalPages = Math.ceil(filteredErrors.length / itemsPerPage);
  const paginatedErrors = filteredErrors.slice(
    (errorsPage - 1) * itemsPerPage,
    errorsPage * itemsPerPage
  );

  const severityColors = {
    low: 'bg-blue-500',
    medium: 'bg-yellow-500',
    high: 'bg-orange-500',
    critical: 'bg-red-500',
  };

  const severityLabels = {
    low: 'Baixa',
    medium: 'Média',
    high: 'Alta',
    critical: 'Crítica',
  };

  const resetInstanceForm = () => {
    setInstanceForm({
      name: '',
      url: '',
      api_key: '',
      check_interval: '5',
      active: true,
    });
  };

  const handleAddInstance = () => {
    resetInstanceForm();
    setSelectedInstance(null);
    setDialogMode('add-instance');
  };

  const handleEditInstance = (instance: N8NInstance) => {
    setSelectedInstance(instance);
    setInstanceForm({
      name: instance.name,
      url: instance.url,
      api_key: '****************', // Mostrar mascarado
      check_interval: instance.check_interval.toString(),
      active: instance.active,
    });
    setDialogMode('edit-instance');
  };

  const handleViewError = (error: N8NError) => {
    setSelectedError(error);
    setDialogMode('view-error');
  };

  const handleViewErrorHistory = (instance: N8NInstance) => {
    setSelectedInstance(instance);
    setDialogMode('error-history');
  };

  const handleSaveInstance = async () => {
    if (!instanceForm.name || !instanceForm.url || !instanceForm.api_key) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    setIsSubmitting(true);
    try {
      const supabase = createClient();

      if (dialogMode === 'add-instance') {
        // Criar nova instância
        const response = await fetch('/api/admin/n8n/instances', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: instanceForm.name,
            url: instanceForm.url,
            api_key: instanceForm.api_key,
            check_interval: parseInt(instanceForm.check_interval),
            active: instanceForm.active,
          }),
        });

        if (!response.ok) {
          throw new Error('Erro ao criar instância');
        }

        toast.success('Instância criada com sucesso!');
      } else if (dialogMode === 'edit-instance' && selectedInstance) {
        // Atualizar instância existente
        const updateData: any = {
          name: instanceForm.name,
          url: instanceForm.url,
          check_interval: parseInt(instanceForm.check_interval),
          active: instanceForm.active,
        };

        // Só atualizar API key se foi modificada (não está mascarada)
        if (instanceForm.api_key !== '****************') {
          updateData.api_key = instanceForm.api_key;
        }

        const response = await fetch(`/api/admin/n8n/instances/${selectedInstance.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updateData),
        });

        if (!response.ok) {
          throw new Error('Erro ao atualizar instância');
        }

        toast.success('Instância atualizada com sucesso!');
      }

      setDialogMode(null);
      router.refresh();
    } catch (error) {
      toast.error('Erro ao salvar instância');
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteInstance = async (instanceId: string) => {
    if (!confirm('Tem certeza que deseja remover esta instância? Todos os erros associados serão removidos.')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/n8n/instances/${instanceId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Erro ao remover instância');
      }

      toast.success('Instância removida com sucesso!');
      router.refresh();
    } catch (error) {
      toast.error('Erro ao remover instância');
      console.error(error);
    }
  };

  const handleResolveError = async (errorId: string) => {
    try {
      const supabase = createClient();

      await supabase
        .from('n8n_errors')
        .update({ resolved: true })
        .eq('id', errorId);

      toast.success('Erro marcado como resolvido!');
      setDialogMode(null);
      router.refresh();
    } catch (error) {
      toast.error('Erro ao resolver');
      console.error(error);
    }
  };

  const handleIgnoreError = async (errorId: string) => {
    try {
      const supabase = createClient();

      await supabase
        .from('n8n_errors')
        .update({ notified: true, resolved: true })
        .eq('id', errorId);

      toast.success('Erro ignorado!');
      setDialogMode(null);
      router.refresh();
    } catch (error) {
      toast.error('Erro ao ignorar');
      console.error(error);
    }
  };

  const handleReprocessError = async (error: N8NError) => {
    toast.info('Função de reprocessamento será implementada com a API do N8N');
  };

  const handleAnalyzeWithAI = async (errorId: string) => {
    try {
      setIsSubmitting(true);
      const response = await fetch('/api/admin/n8n/analyze-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ errorId }),
      });

      if (!response.ok) {
        throw new Error('Erro ao analisar com IA');
      }

      const data = await response.json();
      toast.success('Análise IA concluída!');

      // Atualizar erro selecionado com análise
      if (selectedError && selectedError.id === errorId) {
        setSelectedError({ ...selectedError, ai_analysis: data.analysis });
      }

      router.refresh();
    } catch (error) {
      toast.error('Erro ao analisar com IA');
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleString('pt-BR');
  };

  const getStatusColor = (active: boolean) => {
    return active ? 'bg-green-500' : 'bg-gray-500';
  };

  const getInstanceErrors = (instanceId: string) => {
    return initialErrors.filter(e => e.instance_id === instanceId && !e.resolved);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Monitor N8N</h1>
          <p className="text-muted-foreground mt-1">
            Monitore instâncias e erros de workflows
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleSync}
            disabled={isSyncing}
          >
            <RefreshCw className={cn('h-4 w-4 mr-2', isSyncing && 'animate-spin')} />
            {isSyncing ? 'Sincronizando...' : 'Sincronizar'}
          </Button>
          <Button onClick={handleAddInstance}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Instância
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Instâncias</p>
              <p className="text-3xl font-bold mt-1">{stats.totalInstances}</p>
            </div>
            <Server className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Erros 24h</p>
              <p className="text-3xl font-bold mt-1">{stats.errors24h}</p>
            </div>
            <AlertCircle className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Uptime Médio</p>
              <p className="text-3xl font-bold mt-1">{stats.uptimeAverage}%</p>
            </div>
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Instâncias Ativas</p>
              <p className="text-3xl font-bold mt-1">{stats.activeInstances}</p>
            </div>
            <Activity className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>
      </div>

      {/* Instâncias Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Instâncias N8N</h2>
          <div className="flex gap-2">
            <Button
              variant={filterStatus === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterStatus('all')}
            >
              Todas
            </Button>
            <Button
              variant={filterStatus === 'active' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterStatus('active')}
            >
              Ativas
            </Button>
            <Button
              variant={filterStatus === 'inactive' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterStatus('inactive')}
            >
              Inativas
            </Button>
          </div>
        </div>

        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                <TableHead>Nome</TableHead>
                <TableHead>URL</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Último Check</TableHead>
                <TableHead>Erros</TableHead>
                <TableHead>Intervalo</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedInstances.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    Nenhuma instância encontrada
                  </TableCell>
                </TableRow>
              ) : (
                paginatedInstances.map((instance) => {
                  const instanceErrors = getInstanceErrors(instance.id);
                  return (
                    <TableRow key={instance.id} className="border-border">
                      <TableCell className="font-medium">{instance.name}</TableCell>
                      <TableCell className="max-w-xs truncate">
                        <a
                          href={instance.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:underline"
                        >
                          {instance.url}
                        </a>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(instance.active)}>
                          {instance.active ? 'Ativa' : 'Inativa'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDate(instance.last_check)}
                      </TableCell>
                      <TableCell>
                        {instanceErrors.length > 0 ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewErrorHistory(instance)}
                            className="text-red-400 hover:text-red-300"
                          >
                            {instanceErrors.length} erro(s)
                          </Button>
                        ) : (
                          <span className="text-green-400">0 erros</span>
                        )}
                      </TableCell>
                      <TableCell>{instance.check_interval}min</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditInstance(instance)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteInstance(instance.id)}
                            className="text-red-400 hover:text-red-300"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>

          {/* Paginação de Instâncias */}
          {filteredInstances.length > 0 && instancesTotalPages > 1 && (
            <div className="p-4 border-t border-border">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => setInstancesPage(p => Math.max(1, p - 1))}
                      className={instancesPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>

                  {Array.from({ length: instancesTotalPages }, (_, i) => i + 1).map((page) => {
                    if (
                      page === 1 ||
                      page === instancesTotalPages ||
                      (page >= instancesPage - 1 && page <= instancesPage + 1)
                    ) {
                      return (
                        <PaginationItem key={page}>
                          <PaginationLink
                            onClick={() => setInstancesPage(page)}
                            isActive={instancesPage === page}
                            className="cursor-pointer"
                          >
                            {page}
                          </PaginationLink>
                        </PaginationItem>
                      );
                    } else if (page === instancesPage - 2 || page === instancesPage + 2) {
                      return <PaginationEllipsis key={page} />;
                    }
                    return null;
                  })}

                  <PaginationItem>
                    <PaginationNext
                      onClick={() => setInstancesPage(p => Math.min(instancesTotalPages, p + 1))}
                      className={instancesPage === instancesTotalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </div>
      </div>

      {/* Erros Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Histórico de Erros</h2>
          <div className="flex gap-2">
            <Select value={filterResolved} onValueChange={setFilterResolved}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="unresolved">Não Resolvidos</SelectItem>
                <SelectItem value="resolved">Resolvidos</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterSeverity} onValueChange={setFilterSeverity}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Severidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="low">Baixa</SelectItem>
                <SelectItem value="medium">Média</SelectItem>
                <SelectItem value="high">Alta</SelectItem>
                <SelectItem value="critical">Crítica</SelectItem>
              </SelectContent>
            </Select>
            {uniqueWorkflows.length > 0 && (
              <Select value={filterWorkflow} onValueChange={setFilterWorkflow}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Workflow" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Workflows</SelectItem>
                  {uniqueWorkflows.map((wf) => (
                    <SelectItem key={wf} value={wf}>{wf}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                <TableHead>Instância</TableHead>
                <TableHead>Workflow</TableHead>
                <TableHead>Node</TableHead>
                <TableHead>Erro</TableHead>
                <TableHead>Severidade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedErrors.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    Nenhum erro encontrado
                  </TableCell>
                </TableRow>
              ) : (
                paginatedErrors.map((error) => (
                  <TableRow key={error.id} className="border-border">
                    <TableCell className="font-medium">
                      {error.instance?.name || 'N/A'}
                    </TableCell>
                    <TableCell className="max-w-[150px] truncate">
                      {error.workflow_name}
                    </TableCell>
                    <TableCell>{error.error_node}</TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {error.error_message}
                    </TableCell>
                    <TableCell>
                      <Badge className={severityColors[error.severity]}>
                        {severityLabels[error.severity]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {error.resolved ? (
                        <Badge className="bg-green-500">Resolvido</Badge>
                      ) : (
                        <Badge className="bg-red-500">Pendente</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDate(error.timestamp)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewError(error)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Paginação de Erros */}
          {filteredErrors.length > 0 && errorsTotalPages > 1 && (
            <div className="p-4 border-t border-border">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => setErrorsPage(p => Math.max(1, p - 1))}
                      className={errorsPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>

                  {Array.from({ length: errorsTotalPages }, (_, i) => i + 1).map((page) => {
                    if (
                      page === 1 ||
                      page === errorsTotalPages ||
                      (page >= errorsPage - 1 && page <= errorsPage + 1)
                    ) {
                      return (
                        <PaginationItem key={page}>
                          <PaginationLink
                            onClick={() => setErrorsPage(page)}
                            isActive={errorsPage === page}
                            className="cursor-pointer"
                          >
                            {page}
                          </PaginationLink>
                        </PaginationItem>
                      );
                    } else if (page === errorsPage - 2 || page === errorsPage + 2) {
                      return <PaginationEllipsis key={page} />;
                    }
                    return null;
                  })}

                  <PaginationItem>
                    <PaginationNext
                      onClick={() => setErrorsPage(p => Math.min(errorsTotalPages, p + 1))}
                      className={errorsPage === errorsTotalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </div>
      </div>

      {/* Dialog - Add/Edit Instance */}
      <Dialog open={dialogMode === 'add-instance' || dialogMode === 'edit-instance'} onOpenChange={() => setDialogMode(null)}>
        <DialogContent className="max-w-2xl bg-card border-border">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === 'add-instance' ? 'Nova Instância N8N' : 'Editar Instância N8N'}
            </DialogTitle>
            <DialogDescription>
              Configure os detalhes da instância N8N para monitoramento
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Nome da Instância</Label>
              <Input
                id="name"
                value={instanceForm.name}
                onChange={(e) => setInstanceForm({ ...instanceForm, name: e.target.value })}
                placeholder="Ex: N8N Produção"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="url">URL da Instância</Label>
              <Input
                id="url"
                value={instanceForm.url}
                onChange={(e) => setInstanceForm({ ...instanceForm, url: e.target.value })}
                placeholder="https://n8n.exemplo.com"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="api_key">API Key</Label>
              <Input
                id="api_key"
                type="password"
                value={instanceForm.api_key}
                onChange={(e) => setInstanceForm({ ...instanceForm, api_key: e.target.value })}
                placeholder="API Key do N8N"
                className="mt-1"
              />
              {dialogMode === 'edit-instance' && (
                <p className="text-xs text-muted-foreground mt-1">
                  Deixe em branco para manter a API key atual
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="check_interval">Intervalo de Verificação (minutos)</Label>
              <Input
                id="check_interval"
                type="number"
                value={instanceForm.check_interval}
                onChange={(e) => setInstanceForm({ ...instanceForm, check_interval: e.target.value })}
                placeholder="5"
                className="mt-1"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="active"
                checked={instanceForm.active}
                onChange={(e) => setInstanceForm({ ...instanceForm, active: e.target.checked })}
                className="rounded"
              />
              <Label htmlFor="active" className="cursor-pointer">
                Instância ativa
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogMode(null)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button onClick={handleSaveInstance} disabled={isSubmitting}>
              {isSubmitting ? 'Salvando...' : dialogMode === 'add-instance' ? 'Criar Instância' : 'Salvar Alterações'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog - View Error */}
      <Dialog open={dialogMode === 'view-error'} onOpenChange={() => setDialogMode(null)}>
        <DialogContent className="max-w-3xl bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-400" />
              Detalhes do Erro
            </DialogTitle>
            <DialogDescription>
              {selectedError?.workflow_name} - {formatDate(selectedError?.timestamp || '')}
            </DialogDescription>
          </DialogHeader>

          {selectedError && (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Instância</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedError.instance?.name || 'N/A'}
                  </p>
                </div>
                <div>
                  <Label>Workflow</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedError.workflow_name}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Node com Erro</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedError.error_node}
                  </p>
                </div>
                <div>
                  <Label>Severidade</Label>
                  <Badge className={`${severityColors[selectedError.severity]} mt-1`}>
                    {severityLabels[selectedError.severity]}
                  </Badge>
                </div>
              </div>

              <div>
                <Label>Mensagem de Erro</Label>
                <div className="mt-1 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                  <p className="text-sm text-red-400 font-mono">
                    {selectedError.error_message}
                  </p>
                </div>
              </div>

              {selectedError.error_details && (
                <div>
                  <Label>Detalhes Técnicos</Label>
                  <div className="mt-1 p-3 rounded-lg bg-muted/50 border border-border">
                    <pre className="text-xs text-muted-foreground overflow-x-auto">
                      {selectedError.error_details}
                    </pre>
                  </div>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-purple-400" />
                    Análise IA
                  </Label>
                  {!selectedError.ai_analysis && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAnalyzeWithAI(selectedError.id)}
                      disabled={isSubmitting}
                      className="text-purple-400 border-purple-400/30 hover:bg-purple-400/10"
                    >
                      <Sparkles className="h-3 w-3 mr-1" />
                      Analisar com IA
                    </Button>
                  )}
                </div>
                <div className="mt-1 p-4 rounded-lg bg-muted/50 border border-border">
                  {selectedError.ai_analysis ? (
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {selectedError.ai_analysis}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      Nenhuma análise IA disponível. Clique no botão acima para gerar.
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border">
                <div>
                  <Label>Execution ID</Label>
                  <p className="text-xs text-muted-foreground mt-1 font-mono">
                    {selectedError.execution_id}
                  </p>
                </div>
                <div>
                  <Label>Workflow ID</Label>
                  <p className="text-xs text-muted-foreground mt-1 font-mono">
                    {selectedError.workflow_id}
                  </p>
                </div>
                <div>
                  <Label>Status</Label>
                  <Badge className={`mt-1 ${selectedError.resolved ? 'bg-green-500' : 'bg-red-500'}`}>
                    {selectedError.resolved ? 'Resolvido' : 'Pendente'}
                  </Badge>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={() => setDialogMode(null)}
            >
              Fechar
            </Button>
            {selectedError && !selectedError.resolved && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => handleIgnoreError(selectedError.id)}
                  className="text-gray-400"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Ignorar
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleReprocessError(selectedError)}
                  className="text-blue-400"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Reprocessar
                </Button>
                <Button
                  onClick={() => handleResolveError(selectedError.id)}
                  className="bg-green-500 hover:bg-green-600"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Resolver
                </Button>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog - Error History */}
      <Dialog open={dialogMode === 'error-history'} onOpenChange={() => setDialogMode(null)}>
        <DialogContent className="max-w-4xl bg-card border-border">
          <DialogHeader>
            <DialogTitle>
              Histórico de Erros - {selectedInstance?.name}
            </DialogTitle>
            <DialogDescription>
              Últimos erros registrados para esta instância
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead>Data</TableHead>
                  <TableHead>Workflow</TableHead>
                  <TableHead>Node</TableHead>
                  <TableHead>Erro</TableHead>
                  <TableHead>Severidade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedInstance &&
                  initialErrors
                    .filter(e => e.instance_id === selectedInstance.id)
                    .map((error) => (
                      <TableRow key={error.id} className="border-border">
                        <TableCell className="text-sm">
                          {formatDate(error.timestamp)}
                        </TableCell>
                        <TableCell className="max-w-[150px] truncate">
                          {error.workflow_name}
                        </TableCell>
                        <TableCell>{error.error_node}</TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {error.error_message}
                        </TableCell>
                        <TableCell>
                          <Badge className={severityColors[error.severity]}>
                            {severityLabels[error.severity]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {error.resolved ? (
                            <Badge className="bg-green-500">Resolvido</Badge>
                          ) : (
                            <Badge className="bg-red-500">Pendente</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewError(error)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
              </TableBody>
            </Table>
          </div>

          <DialogFooter>
            <Button onClick={() => setDialogMode(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
