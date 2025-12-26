'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/lib/hooks/useUser';
import { Card, CardContent } from '@/components/ui/card';
import { User, MessageCircle, TrendingUp, DollarSign } from 'lucide-react';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { DateFilter } from '@/components/dashboard/DateFilter';
import { ConversionDonut } from '@/components/dashboard/ConversionDonut';
import { SalesFunnel } from '@/components/dashboard/SalesFunnel';
import { DateRange } from 'react-day-picker';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';

interface Lead {
  id: string;
  status: string;
  project_value: number;
  created_at: string;
}

export default function DashboardPage() {
  const { company, loading: userLoading } = useUser();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month' | 'year' | 'custom'>('today');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  useEffect(() => {
    if (!userLoading && company?.id) {
      fetchLeads();
    }
  }, [userLoading, company]);

  async function fetchLeads() {
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from('leads')
        .select('*')
        .eq('company_id', company?.id)
        .order('created_at', { ascending: false });

      setLeads(data || []);
    } catch (error) {
      console.error('Error fetching leads:', error);
    } finally {
      setLoading(false);
    }
  }

  // Get date range based on selected period
  const getDateRange = () => {
    const now = new Date();
    switch (selectedPeriod) {
      case 'today':
        return { start: startOfDay(now), end: endOfDay(now) };
      case 'week':
        return { start: startOfWeek(now), end: endOfWeek(now) };
      case 'month':
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case 'year':
        return { start: startOfYear(now), end: endOfYear(now) };
      case 'custom':
        return {
          start: dateRange?.from || startOfDay(now),
          end: dateRange?.to || endOfDay(now),
        };
      default:
        return { start: startOfDay(now), end: endOfDay(now) };
    }
  };

  const { start, end } = getDateRange();

  // Filter leads by date range
  const filteredLeads = leads.filter((lead) => {
    const leadDate = new Date(lead.created_at);
    return leadDate >= start && leadDate <= end;
  });

  // Calculate metrics
  const totalLeads = filteredLeads.length;
  const leadsEmAtendimento = filteredLeads.filter(
    (l) => l.status === 'Em contato' || l.status === 'Interessado'
  ).length;
  const fechados = filteredLeads.filter((l) => l.status === 'Fechado').length;
  const taxaConversao = totalLeads > 0 ? (fechados / totalLeads).toFixed(1) : '0.0';
  const faturamento = filteredLeads
    .filter((l) => l.status === 'Fechado')
    .reduce((sum, l) => sum + (l.project_value || 0), 0);

  // Conversion donut data
  const conversionData = [
    { name: 'Fechados', value: fechados, color: '#191919' },
    { name: 'Em andamento', value: totalLeads - fechados, color: 'hsl(var(--primary))' },
  ];

  // Funnel data
  const funnelStages = [
    {
      label: 'Novos',
      count: filteredLeads.filter((l) => l.status === 'Lead novo').length,
      color: 'bg-primary',
    },
    {
      label: 'Em contato',
      count: filteredLeads.filter((l) => l.status === 'Em contato').length,
      color: 'bg-primary',
    },
    {
      label: 'Interessado',
      count: filteredLeads.filter((l) => l.status === 'Interessado').length,
      color: 'bg-primary',
    },
    {
      label: 'Proposta',
      count: filteredLeads.filter((l) => l.status === 'Proposta enviada').length,
      color: 'bg-primary',
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />

      <div className="p-6 space-y-6">
        {/* Overview Title + Filters */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Overview</h1>
          <DateFilter
            selectedPeriod={selectedPeriod}
            onPeriodChange={setSelectedPeriod}
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
          />
        </div>

        {/* Main Grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column - Stats Cards + Performance */}
          <div className="lg:col-span-2 space-y-6">
            {/* Stats Grid - 2x2 */}
            <div className="grid sm:grid-cols-2 gap-4">
              {/* Novos Leads */}
              <Card className="border-2">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">
                        Novos leads
                      </p>
                      <h3 className="text-4xl font-bold">{totalLeads}</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        novos leads cadastrados
                      </p>
                    </div>
                    <div className="p-3 bg-primary/10 rounded-full">
                      <User className="h-6 w-6 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Em Atendimento */}
              <Card className="border-2">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">
                        Em atendimento
                      </p>
                      <h3 className="text-4xl font-bold">{leadsEmAtendimento}</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        Leads em atendimento
                      </p>
                    </div>
                    <div className="p-3 bg-whatsapp/10 rounded-full">
                      <MessageCircle className="h-6 w-6 text-whatsapp" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Taxa de Conversão */}
              <Card className="border-2">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">
                        Taxa de conversão
                      </p>
                      <h3 className="text-4xl font-bold">{taxaConversao}</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        Leads convertidos
                      </p>
                    </div>
                    <div className="p-3 bg-primary/10 rounded-full">
                      <TrendingUp className="h-6 w-6 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Faturamento */}
              <Card className="border-2">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">
                        Faturamento
                      </p>
                      <h3 className="text-3xl font-bold">
                        R$ {faturamento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        Valor em negócios
                      </p>
                    </div>
                    <div className="p-3 bg-primary/10 rounded-full">
                      <DollarSign className="h-6 w-6 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Performance de Lead - Simple bar chart */}
            <Card className="border-2">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-6">Performance de Lead</h3>
                <div className="space-y-4">
                  {funnelStages.map((stage, index) => (
                    <div key={stage.label} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{stage.label}</span>
                        <span className="text-muted-foreground">{stage.count}</span>
                      </div>
                      <div className="h-12 bg-muted rounded-lg overflow-hidden">
                        <div
                          className={`h-full ${stage.color} transition-all duration-500`}
                          style={{
                            width: totalLeads > 0 ? `${(stage.count / totalLeads) * 100}%` : '0%',
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Conversion Donut + Funnel */}
          <div className="space-y-6">
            <ConversionDonut data={conversionData} />
            <SalesFunnel stages={funnelStages} totalLeads={totalLeads} />
          </div>
        </div>
      </div>
    </div>
  );
}
