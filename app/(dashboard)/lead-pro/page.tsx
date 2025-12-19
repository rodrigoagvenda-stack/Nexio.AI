'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/lib/hooks/useUser';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Target, Loader2, TrendingUp } from 'lucide-react';

export default function LeadProPage() {
  const { company } = useUser();
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const [icpLeads, setICPLeads] = useState<any[]>([]);
  const [stats, setStats] = useState({
    extracted: 0,
    limit: 0,
    remaining: 0,
  });

  useEffect(() => {
    if (company?.id) {
      fetchData();
    }
  }, [company]);

  async function fetchData() {
    try {
      const supabase = createClient();

      // Buscar leads ICP
      const { data: leads } = await supabase
        .from('ICP_leads')
        .select('*')
        .eq('company_id', company?.id)
        .order('created_at', { ascending: false });

      setICPLeads(leads || []);

      // Calcular estatísticas
      const extracted = company?.leads_extracted_this_month || 0;
      const limit = company?.plan_monthly_limit || 0;
      const remaining = Math.max(0, limit - extracted);

      setStats({ extracted, limit, remaining });
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleExtract() {
    setExtracting(true);
    try {
      const response = await fetch('/api/extraction/icp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: company?.id }),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.message);

      toast.success(`${data.extractedCount} leads extraídos com sucesso!`);
      await fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao extrair leads');
    } finally {
      setExtracting(false);
    }
  }

  if (!company?.vendagro_plan) {
    return (
      <div className="flex items-center justify-center h-96">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <Target className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Lead PRO não disponível</h3>
            <p className="text-sm text-muted-foreground">
              Entre em contato com o admin para ativar o módulo VendAgro
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-shimmer h-8 w-32 rounded-lg" />
      </div>
    );
  }

  const progressPercent = stats.limit > 0 ? (stats.extracted / stats.limit) * 100 : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Lead PRO - VendAgro</h1>
        <p className="text-muted-foreground mt-1">
          Leads qualificados baseados no seu ICP
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Limite Mensal</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.limit}</div>
            <p className="text-xs text-muted-foreground">leads/mês</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Extraídos</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.extracted}</div>
            <p className="text-xs text-muted-foreground">este mês</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Disponíveis</CardTitle>
            <Target className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{stats.remaining}</div>
            <p className="text-xs text-muted-foreground">restantes</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Progresso Mensal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Progress value={progressPercent} />
          <div className="flex justify-between text-sm">
            <span>{stats.extracted} extraídos</span>
            <span>{stats.limit} limite</span>
          </div>
          <Button
            onClick={handleExtract}
            disabled={extracting || stats.remaining === 0}
            className="w-full"
            size="lg"
          >
            {extracting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Extraindo...
              </>
            ) : stats.remaining === 0 ? (
              'Limite Mensal Atingido'
            ) : (
              'Extrair Leads ICP'
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Leads Extraídos ({icpLeads.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {icpLeads.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                Nenhum lead extraído ainda. Clique em &quot;Extrair Leads ICP&quot; para começar.
              </p>
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
                    <th className="text-left p-3">Segmento</th>
                  </tr>
                </thead>
                <tbody>
                  {icpLeads.map((lead) => (
                    <tr key={lead.id} className="border-b hover:bg-accent">
                      <td className="p-3 font-medium">{lead.nome}</td>
                      <td className="p-3">{lead.empresa}</td>
                      <td className="p-3 text-sm text-muted-foreground">{lead.email}</td>
                      <td className="p-3 text-sm text-muted-foreground">{lead.whatsapp}</td>
                      <td className="p-3 text-sm">{lead.segmento}</td>
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
