'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { ArrowLeft, FileDown } from 'lucide-react';
import { BriefingResponse } from '@/types/briefing';
import { formatDateTime } from '@/lib/utils/format';

export default function BriefingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [response, setResponse] = useState<BriefingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    fetchResponse();
  }, [params.id]);

  async function fetchResponse() {
    try {
      const res = await fetch(`/api/briefing/responses/${params.id}`);
      const data = await res.json();

      if (!res.ok) throw new Error(data.message);

      setResponse(data.data);
    } catch (error: any) {
      console.error('Error fetching response:', error);
      toast.error(error.message || 'Erro ao carregar resposta');
    } finally {
      setLoading(false);
    }
  }

  async function handleDownloadPDF() {
    if (!response) return;

    setDownloading(true);
    try {
      const { pdf } = await import('@react-pdf/renderer');
      const { BriefingPDF } = await import('@/lib/pdf/briefing-generator');

      const blob = await pdf(<BriefingPDF data={response} />).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `briefing-${response.nome_empresa}-${new Date().toISOString().split('T')[0]}.pdf`;
      link.click();
      URL.revokeObjectURL(url);

      toast.success('PDF baixado com sucesso!');
    } catch (error: any) {
      console.error('Error generating PDF:', error);
      toast.error('Erro ao gerar PDF');
    } finally {
      setDownloading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-shimmer h-8 w-32 rounded-lg" />
      </div>
    );
  }

  if (!response) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Resposta não encontrada</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
        <Button variant="outline" onClick={handleDownloadPDF} disabled={downloading}>
          <FileDown className="mr-2 h-4 w-4" />
          {downloading ? 'Gerando PDF...' : 'Baixar PDF'}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Resposta de {response.nome_responsavel}</CardTitle>
          <p className="text-sm text-muted-foreground">
            Preenchido em: {formatDateTime(response.submitted_at)}
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold mb-4">Informações de Contato</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Nome</p>
                <p className="font-medium">{response.nome_responsavel}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{response.email}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">WhatsApp</p>
                <p className="font-medium">
                  {response.country_code} {response.whatsapp}
                </p>
              </div>
            </div>
          </div>

          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold mb-4">Empresa</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Nome</p>
                <p className="font-medium">{response.nome_empresa}</p>
              </div>
              {response.site && (
                <div>
                  <p className="text-sm text-muted-foreground">Site</p>
                  <p className="font-medium">{response.site}</p>
                </div>
              )}
              {response.instagram && (
                <div>
                  <p className="text-sm text-muted-foreground">Instagram</p>
                  <p className="font-medium">{response.instagram}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-muted-foreground">Segmento</p>
                <p className="font-medium">{response.segmento}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tempo de Mercado</p>
                <p className="font-medium">{response.tempo_mercado}</p>
              </div>
            </div>
          </div>

          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold mb-4">Marketing</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Já investe em marketing?</p>
                <p className="font-medium">{response.investe_marketing === 'sim' ? 'Sim' : 'Não'}</p>
              </div>
              {response.investe_marketing === 'sim' && response.resultados && (
                <div>
                  <p className="text-sm text-muted-foreground">Resultados Atuais</p>
                  <p className="font-medium capitalize">{response.resultados}</p>
                </div>
              )}
              {response.investe_marketing === 'nao' && response.objetivo && (
                <div>
                  <p className="text-sm text-muted-foreground">Objetivo Principal</p>
                  <p className="font-medium capitalize">{response.objetivo}</p>
                </div>
              )}
            </div>
          </div>

          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold mb-4">Financeiro</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Faturamento Mensal</p>
                <p className="font-medium">{response.faturamento}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Budget para Marketing</p>
                <p className="font-medium">{response.budget}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
