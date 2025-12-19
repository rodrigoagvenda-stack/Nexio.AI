'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Copy, Settings, Eye, FileText, CheckCircle2, XCircle } from 'lucide-react';
import { BriefingResponse } from '@/types/briefing';
import { formatDateTime } from '@/lib/utils/format';

export default function BriefingListPage() {
  const [responses, setResponses] = useState<BriefingResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [total, setTotal] = useState(0);

  const formUrl = typeof window !== 'undefined' ? `${window.location.origin}/brief` : '';

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
      toast.error(error.message || 'Erro ao carregar respostas');
    } finally {
      setLoading(false);
    }
  }

  const copyFormUrl = () => {
    navigator.clipboard.writeText(formUrl);
    toast.success('Link copiado!');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-shimmer h-8 w-32 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">📋 Respostas do Briefing</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie as respostas do formulário de briefing
          </p>
        </div>
        <Link href="/admin/briefing/configuracoes">
          <Button variant="outline">
            <Settings className="mr-2 h-4 w-4" />
            Configurar Webhook
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Link do Formulário</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Compartilhe este link com seus clientes
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input value={formUrl} readOnly className="font-mono text-sm" />
            <Button onClick={copyFormUrl} variant="outline">
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Respostas ({total})</CardTitle>
            <Input
              placeholder="Buscar por nome, email ou empresa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
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
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3">Nome</th>
                    <th className="text-left p-3">Empresa</th>
                    <th className="text-left p-3">Email</th>
                    <th className="text-left p-3">WhatsApp</th>
                    <th className="text-left p-3">Data</th>
                    <th className="text-left p-3">Webhook</th>
                    <th className="text-left p-3">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {responses.map((response) => (
                    <tr key={response.id} className="border-b hover:bg-accent">
                      <td className="p-3 font-medium">{response.nome_responsavel}</td>
                      <td className="p-3">{response.nome_empresa}</td>
                      <td className="p-3 text-sm text-muted-foreground">{response.email}</td>
                      <td className="p-3 text-sm text-muted-foreground">
                        {response.country_code} {response.whatsapp}
                      </td>
                      <td className="p-3 text-sm text-muted-foreground">
                        {formatDateTime(response.submitted_at)}
                      </td>
                      <td className="p-3">
                        {response.webhook_sent ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
