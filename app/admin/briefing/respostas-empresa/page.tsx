'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import { ArrowLeft, Search, ChevronDown, ChevronUp, CheckCircle2, XCircle, Building2 } from 'lucide-react';
import { formatDateTime } from '@/lib/utils/format';

interface BriefingMTResponse {
  id: number;
  company_id: number;
  answers: Record<string, any>;
  submitted_at: string;
  webhook_sent: boolean;
  webhook_sent_at?: string;
  companies: { id: number; name: string };
}

export default function RespostasEmpresaPage() {
  const [responses, setResponses] = useState<BriefingMTResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 50;

  useEffect(() => {
    fetchResponses();
  }, [page]);

  async function fetchResponses() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/briefing/mt-responses?page=${page}&limit=${limit}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setResponses(data.data);
      setTotal(data.pagination.total);
    } catch (error: any) {
      toast({ title: 'Erro ao carregar respostas', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  const filtered = responses.filter((r) => {
    const companyName = r.companies?.name?.toLowerCase() || '';
    const answersStr = JSON.stringify(r.answers).toLowerCase();
    const q = search.toLowerCase();
    return companyName.includes(q) || answersStr.includes(q);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/briefing">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Voltar
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Respostas de Briefing por Empresa</h1>
          <p className="text-sm text-muted-foreground">{total} resposta{total !== 1 ? 's' : ''} no total</p>
        </div>
      </div>

      {/* Busca */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar empresa ou resposta..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Tabela */}
      <Card>
        <CardHeader>
          <CardTitle>Respostas</CardTitle>
          <CardDescription>Briefings enviados pelos formulários de cada empresa</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12 text-muted-foreground">Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-muted-foreground gap-2">
              <Building2 className="h-8 w-8" />
              <p>Nenhuma resposta encontrada</p>
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map((r) => (
                <div key={r.id} className="p-4">
                  {/* Linha principal */}
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
                        {r.companies?.name?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{r.companies?.name || `Empresa #${r.company_id}`}</p>
                        <p className="text-xs text-muted-foreground">{formatDateTime(r.submitted_at)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {r.webhook_sent ? (
                        <Badge variant="outline" className="gap-1 text-green-600 border-green-200">
                          <CheckCircle2 className="h-3 w-3" />
                          Webhook enviado
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 text-muted-foreground">
                          <XCircle className="h-3 w-3" />
                          Webhook pendente
                        </Badge>
                      )}
                      {expanded === r.id ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>

                  {/* Respostas expandidas */}
                  {expanded === r.id && (
                    <div className="mt-4 pt-4 border-t grid gap-3 sm:grid-cols-2">
                      {Object.entries(r.answers).map(([key, value]) => (
                        <div key={key} className="space-y-0.5">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            {key.replace(/_/g, ' ')}
                          </p>
                          <p className="text-sm text-foreground">
                            {Array.isArray(value) ? value.join(', ') : String(value || '—')}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Paginação simples */}
      {total > limit && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>
            Anterior
          </Button>
          <span className="flex items-center text-sm text-muted-foreground px-2">
            Página {page} de {Math.ceil(total / limit)}
          </span>
          <Button variant="outline" size="sm" disabled={page >= Math.ceil(total / limit)} onClick={() => setPage(page + 1)}>
            Próxima
          </Button>
        </div>
      )}
    </div>
  );
}
