'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import {
  ArrowLeft,
  Loader2,
  Mail,
  Phone,
  Building2,
  Briefcase,
  Target,
  Clock,
  DollarSign,
  Users,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { LeadQualificationResponse } from '@/types/lead-qualification';
import { formatDateTime } from '@/lib/utils/format';
import {
  VOLUME_ATENDIMENTOS_OPTIONS,
  GARGALO_OPTIONS,
  PROCESSO_VENDAS_OPTIONS,
  URGENCIA_OPTIONS,
  BUDGET_OPTIONS,
} from '@/types/lead-qualification';

function getLabel(options: { value: string; label: string }[], value: string): string {
  return options.find((o) => o.value === value)?.label || value;
}

export default function LeadQualificationDetailPage() {
  const params = useParams();
  const [response, setResponse] = useState<LeadQualificationResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchResponse();
  }, [params.id]);

  async function fetchResponse() {
    try {
      const res = await fetch(`/api/lead-qualification/responses?id=${params.id}`);
      const data = await res.json();

      if (!res.ok) throw new Error(data.message);

      // Buscar pelo ID na lista
      const found = data.data?.find((r: LeadQualificationResponse) => r.id.toString() === params.id);
      if (!found) throw new Error('Resposta não encontrada');

      setResponse(found);
    } catch (error: any) {
      console.error('Error fetching response:', error);
      toast({ title: error.message || 'Erro ao carregar resposta', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!response) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Resposta não encontrada</p>
        <Link href="/admin/qualificacao">
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/qualificacao">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl md:text-3xl font-bold">{response.nome_completo}</h1>
          <p className="text-muted-foreground mt-1">{response.nome_empresa}</p>
        </div>
        <div className="flex items-center gap-2">
          {response.webhook_sent ? (
            <div className="flex items-center gap-1 text-sm text-green-500">
              <CheckCircle2 className="h-4 w-4" />
              Webhook enviado
            </div>
          ) : (
            <div className="flex items-center gap-1 text-sm text-gray-500">
              <XCircle className="h-4 w-4" />
              Webhook pendente
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Informações de Contato */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Informações de Contato
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Mail className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">E-mail</p>
                <p className="text-sm font-medium">{response.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Phone className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">WhatsApp</p>
                <p className="text-sm font-medium">{response.country_code} {response.whatsapp}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Building2 className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Empresa</p>
                <p className="text-sm font-medium">{response.nome_empresa}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Briefcase className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Segmento</p>
                <p className="text-sm font-medium">{response.segmento_negocio}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Qualificação */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Qualificação do Negócio
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground">Volume de atendimentos/dia</p>
              <p className="text-sm font-medium">{getLabel(VOLUME_ATENDIMENTOS_OPTIONS, response.volume_atendimentos)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Principal gargalo</p>
              <p className="text-sm font-medium">{getLabel(GARGALO_OPTIONS, response.principal_gargalo)}</p>
            </div>
            {response.dor_principal && (
              <div>
                <p className="text-xs text-muted-foreground">Dor principal descrita</p>
                <p className="text-sm font-medium">{response.dor_principal}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground">Processo de vendas</p>
              <p className="text-sm font-medium">{getLabel(PROCESSO_VENDAS_OPTIONS, response.processo_vendas)}</p>
            </div>
          </CardContent>
        </Card>

        {/* Maturidade Comercial */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Maturidade Comercial
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {response.ticket_medio && (
              <div>
                <p className="text-xs text-muted-foreground">Ticket médio</p>
                <p className="text-sm font-medium">{response.ticket_medio}</p>
              </div>
            )}
            {response.pessoas_comercial && (
              <div>
                <p className="text-xs text-muted-foreground">Pessoas no comercial</p>
                <p className="text-sm font-medium">{response.pessoas_comercial}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground">Budget disponível</p>
              <p className="text-sm font-medium">{getLabel(BUDGET_OPTIONS, response.budget)}</p>
            </div>
          </CardContent>
        </Card>

        {/* Urgência */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Urgência e Timing
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground">Urgência</p>
              <p className={`text-sm font-medium ${
                response.urgencia === 'urgente' ? 'text-red-500' :
                response.urgencia === 'curto_prazo' ? 'text-yellow-500' : ''
              }`}>
                {getLabel(URGENCIA_OPTIONS, response.urgencia)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Enviado em</p>
              <p className="text-sm font-medium">{formatDateTime(response.submitted_at)}</p>
            </div>
            {response.webhook_sent_at && (
              <div>
                <p className="text-xs text-muted-foreground">Webhook enviado em</p>
                <p className="text-sm font-medium">{formatDateTime(response.webhook_sent_at)}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
