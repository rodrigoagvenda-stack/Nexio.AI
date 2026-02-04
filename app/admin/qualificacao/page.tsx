'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  Copy,
  Settings,
  Eye,
  FileText,
  CheckCircle2,
  XCircle,
  Users,
  Download,
  Trash2,
  Loader2,
} from 'lucide-react';
import { LeadQualificationResponse } from '@/types/lead-qualification';
import { formatDateTime } from '@/lib/utils/format';
import { SimplePagination } from '@/components/ui/pagination-simple';
import {
  VOLUME_ATENDIMENTOS_OPTIONS,
  GARGALO_OPTIONS,
  URGENCIA_OPTIONS,
  BUDGET_OPTIONS,
  PROCESSO_VENDAS_OPTIONS,
} from '@/types/lead-qualification';
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

function getLabel(options: { value: string; label: string }[], value: string): string {
  return options.find((o) => o.value === value)?.label || value;
}

export default function LeadQualificationListPage() {
  const [responses, setResponses] = useState<LeadQualificationResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const itemsPerPage = 10;

  const formUrl = typeof window !== 'undefined' ? `${window.location.origin}/qualificacao` : '';

  useEffect(() => {
    fetchResponses();
  }, [search]);

  async function fetchResponses() {
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);

      const response = await fetch(`/api/lead-qualification/responses?${params}`);
      const data = await response.json();

      if (!response.ok) throw new Error(data.message);

      setResponses(data.data || []);
      setTotal(data.total || 0);
    } catch (error: any) {
      console.error('Error fetching responses:', error);
      toast.error(error.message || 'Erro ao carregar respostas');
    } finally {
      setLoading(false);
    }
  }

  const copyFormUrl = () => {
    navigator.clipboard.writeText(formUrl);
    toast.success('Link copiado!');
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      const response = await fetch(`/api/lead-qualification/responses/${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.message);

      toast.success('Resposta deletada com sucesso');
      setResponses((prev) => prev.filter((r) => r.id !== id));
      setTotal((prev) => prev - 1);
    } catch (error: any) {
      console.error('Error deleting response:', error);
      toast.error(error.message || 'Erro ao deletar resposta');
    } finally {
      setDeletingId(null);
    }
  };

  const handleDownloadCSV = () => {
    if (responses.length === 0) {
      toast.error('Nenhuma resposta para exportar');
      return;
    }

    const headers = [
      'ID',
      'Nome Completo',
      'Email',
      'WhatsApp',
      'Empresa',
      'Segmento',
      'Volume Atendimentos',
      'Principal Gargalo',
      'Dor Principal',
      'Processo de Vendas',
      'Ticket Medio',
      'Pessoas Comercial',
      'Urgencia',
      'Budget',
      'Data Envio',
      'Webhook Enviado',
    ];

    const rows = responses.map((r) => [
      r.id,
      r.nome_completo,
      r.email,
      `${r.country_code} ${r.whatsapp}`,
      r.nome_empresa,
      r.segmento_negocio,
      getLabel(VOLUME_ATENDIMENTOS_OPTIONS, r.volume_atendimentos),
      getLabel(GARGALO_OPTIONS, r.principal_gargalo),
      r.dor_principal || '',
      getLabel(PROCESSO_VENDAS_OPTIONS, r.processo_vendas),
      r.ticket_medio || '',
      r.pessoas_comercial || '',
      getLabel(URGENCIA_OPTIONS, r.urgencia),
      getLabel(BUDGET_OPTIONS, r.budget),
      r.submitted_at,
      r.webhook_sent ? 'Sim' : 'Nao',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `leads-qualificacao-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success('CSV exportado com sucesso!');
  };

  // Pagination
  const totalPages = Math.ceil(responses.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedResponses = responses.slice(startIndex, endIndex);

  // Reset page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-shimmer h-8 w-32 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 md:h-8 md:w-8 text-primary" />
            Qualificacao de Leads
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerencie as respostas do formulario de qualificacao
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleDownloadCSV} className="w-full sm:w-auto">
            <Download className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>
          <Link href="/admin/qualificacao/configuracoes">
            <Button variant="outline" className="w-full sm:w-auto">
              <Settings className="mr-2 h-4 w-4" />
              Configurar Webhook
            </Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Link do Formulario</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Compartilhe este link para captar leads qualificados
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 flex-col sm:flex-row">
            <Input value={formUrl} readOnly className="font-mono text-xs sm:text-sm flex-1" />
            <Button onClick={copyFormUrl} variant="outline" className="sm:w-auto">
              <Copy className="h-4 w-4 sm:mr-0" />
              <span className="sm:hidden ml-2">Copiar Link</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle>Respostas ({total})</CardTitle>
            <Input
              placeholder="Buscar por nome, email ou empresa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:max-w-sm"
            />
          </div>
        </CardHeader>
        <CardContent>
          {responses.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Nenhuma resposta encontrada</p>
            </div>
          ) : (
            <>
              {/* Cards para Mobile */}
              <div className="md:hidden space-y-4">
                {paginatedResponses.map((response) => (
                  <Card key={response.id} className="overflow-hidden">
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-semibold text-base">{response.nome_completo}</h3>
                            <p className="text-xs text-muted-foreground mt-1">{response.nome_empresa}</p>
                          </div>
                          {response.webhook_sent ? (
                            <CheckCircle2 className="h-5 w-5 text-primary" />
                          ) : (
                            <XCircle className="h-5 w-5 text-gray-500" />
                          )}
                        </div>

                        <div className="space-y-2">
                          <div>
                            <p className="text-xs text-muted-foreground">Segmento</p>
                            <p className="text-xs mt-1">{response.segmento_negocio}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Urgencia</p>
                            <p className="text-xs mt-1">{getLabel(URGENCIA_OPTIONS, response.urgencia)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Budget</p>
                            <p className="text-xs mt-1">{getLabel(BUDGET_OPTIONS, response.budget)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Data de Envio</p>
                            <p className="text-xs mt-1">{formatDateTime(response.submitted_at)}</p>
                          </div>
                        </div>

                        <div className="pt-2 border-t flex gap-2">
                          <Link href={`/admin/qualificacao/${response.id}`} className="flex-1">
                            <Button variant="outline" size="sm" className="w-full">
                              <Eye className="h-4 w-4 mr-2" />
                              Ver
                            </Button>
                          </Link>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm" className="text-red-500 hover:text-red-600">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Deletar resposta?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta acao nao pode ser desfeita. A resposta de {response.nome_completo} sera
                                  permanentemente removida.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(response.id)}
                                  className="bg-red-500 hover:bg-red-600"
                                >
                                  {deletingId === response.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    'Deletar'
                                  )}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Tabela para Desktop */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3 text-sm">Nome</th>
                      <th className="text-left p-3 text-sm">Empresa</th>
                      <th className="text-left p-3 text-sm">Segmento</th>
                      <th className="text-left p-3 text-sm">Urgencia</th>
                      <th className="text-left p-3 text-sm">Budget</th>
                      <th className="text-left p-3 text-sm">Data</th>
                      <th className="text-left p-3 text-sm">Webhook</th>
                      <th className="text-left p-3 text-sm">Acoes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedResponses.map((response) => (
                      <tr key={response.id} className="border-b hover:bg-accent">
                        <td className="p-3 font-medium text-sm">{response.nome_completo}</td>
                        <td className="p-3 text-sm">{response.nome_empresa}</td>
                        <td className="p-3 text-sm text-muted-foreground">{response.segmento_negocio}</td>
                        <td className="p-3 text-sm">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            response.urgencia === 'urgente'
                              ? 'bg-red-500/10 text-red-500'
                              : response.urgencia === 'curto_prazo'
                              ? 'bg-yellow-500/10 text-yellow-500'
                              : 'bg-gray-500/10 text-gray-500'
                          }`}>
                            {getLabel(URGENCIA_OPTIONS, response.urgencia)}
                          </span>
                        </td>
                        <td className="p-3 text-xs text-muted-foreground">
                          {getLabel(BUDGET_OPTIONS, response.budget)}
                        </td>
                        <td className="p-3 text-xs text-muted-foreground">
                          {formatDateTime(response.submitted_at)}
                        </td>
                        <td className="p-3">
                          {response.webhook_sent ? (
                            <CheckCircle2 className="h-4 w-4 text-primary" />
                          ) : (
                            <XCircle className="h-4 w-4 text-gray-500" />
                          )}
                        </td>
                        <td className="p-3">
                          <div className="flex gap-2">
                            <Link href={`/admin/qualificacao/${response.id}`}>
                              <Button variant="ghost" size="sm">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Deletar resposta?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Esta acao nao pode ser desfeita. A resposta de {response.nome_completo} sera
                                    permanentemente removida.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDelete(response.id)}
                                    className="bg-red-500 hover:bg-red-600"
                                  >
                                    {deletingId === response.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      'Deletar'
                                    )}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
        {responses.length > 0 && (
          <SimplePagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            totalItems={responses.length}
            itemsPerPage={itemsPerPage}
          />
        )}
      </Card>
    </div>
  );
}
