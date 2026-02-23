'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import { Copy, Settings, Eye, FileText, CheckCircle2, XCircle, UserCheck } from 'lucide-react';
import { BriefingResponse } from '@/types/briefing';
import { formatDateTime } from '@/lib/utils/format';
import { SimplePagination } from '@/components/ui/pagination-simple';

export default function BriefingListPage() {
  const [responses, setResponses] = useState<BriefingResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const formUrl = typeof window !== 'undefined' ? `${window.location.origin}/brief` : '';
  const qualificacaoUrl = typeof window !== 'undefined' ? `${window.location.origin}/qualificacao` : '';

  useEffect(() => {
    fetchResponses();
  }, [search]);

  async function fetchResponses() {
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);

      const response = await fetch(`/api/briefing/responses?${params}`);
      const data = await response.json();

      if (!response.ok) throw new Error(data.message);

      setResponses(data.data || []);
      setTotal(data.total || 0);
    } catch (error: any) {
      console.error('Error fetching responses:', error);
      toast({ title: error.message || 'Erro ao carregar respostas', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  const copyFormUrl = () => {
    navigator.clipboard.writeText(formUrl);
    toast({ title: 'Link copiado!' });
  };

  const copyQualificacaoUrl = () => {
    navigator.clipboard.writeText(qualificacaoUrl);
    toast({ title: 'Link copiado!' });
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
            <FileText className="h-6 w-6 md:h-8 md:w-8 text-primary" />
            Respostas do Briefing
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerencie as respostas do formulário de briefing
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link href="/admin/briefing/respostas-empresa">
            <Button variant="outline" className="w-full sm:w-auto">
              <FileText className="mr-2 h-4 w-4" />
              Briefings por Empresa
            </Button>
          </Link>
          <Link href="/admin/briefing/configuracoes">
            <Button variant="outline" className="w-full sm:w-auto">
              <Settings className="mr-2 h-4 w-4" />
              Configurar Webhook
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-base">Formulário de Briefing</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Briefing completo para clientes
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 flex-col sm:flex-row">
              <Input value={formUrl} readOnly className="font-mono text-xs flex-1" />
              <Button onClick={copyFormUrl} variant="outline" size="sm">
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-green-500" />
              <div>
                <CardTitle className="text-base">Formulário de Qualificação</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Captação de leads qualificados
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 flex-col sm:flex-row">
              <Input value={qualificacaoUrl} readOnly className="font-mono text-xs flex-1" />
              <Button onClick={copyQualificacaoUrl} variant="outline" size="sm">
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

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
                            <h3 className="font-semibold text-base">{response.nome_responsavel}</h3>
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
                            <p className="text-xs text-muted-foreground">Email</p>
                            <p className="text-xs mt-1">{response.email}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">WhatsApp</p>
                            <p className="text-xs mt-1">{response.country_code} {response.whatsapp}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Data de Envio</p>
                            <p className="text-xs mt-1">{formatDateTime(response.submitted_at)}</p>
                          </div>
                        </div>

                        <div className="pt-2 border-t">
                          <Link href={`/admin/briefing/${response.id}`} className="block">
                            <Button variant="outline" size="sm" className="w-full">
                              <Eye className="h-4 w-4 mr-2" />
                              Ver Detalhes
                            </Button>
                          </Link>
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
                      <th className="text-left p-3 text-sm">Email</th>
                      <th className="text-left p-3 text-sm">WhatsApp</th>
                      <th className="text-left p-3 text-sm">Data</th>
                      <th className="text-left p-3 text-sm">Webhook</th>
                      <th className="text-left p-3 text-sm">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedResponses.map((response) => (
                      <tr key={response.id} className="border-b hover:bg-accent">
                        <td className="p-3 font-medium text-sm">{response.nome_responsavel}</td>
                        <td className="p-3 text-sm">{response.nome_empresa}</td>
                        <td className="p-3 text-sm text-muted-foreground">{response.email}</td>
                        <td className="p-3 text-sm text-muted-foreground">
                          {response.country_code} {response.whatsapp}
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
                            <Link href={`/admin/briefing/${response.id}`}>
                              <Button variant="ghost" size="sm">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>
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
