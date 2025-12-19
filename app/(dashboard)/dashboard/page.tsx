import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Users, DollarSign, Target } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/format';

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Buscar company_id do usuário
  const { data: userData } = await supabase
    .from('users')
    .select('company_id')
    .eq('auth_user_id', user.id)
    .single();

  const companyId = userData?.company_id;

  // Buscar métricas
  const { data: leads } = await supabase
    .from('leads')
    .select('*')
    .eq('company_id', companyId);

  const totalLeads = leads?.length || 0;
  const novosLeads = leads?.filter((l) => l.status === 'Lead novo').length || 0;
  const emAtendimento = leads?.filter((l) => l.status === 'Em contato').length || 0;
  const fechados = leads?.filter((l) => l.status === 'Fechado').length || 0;

  const faturamento = leads
    ?.filter((l) => l.status === 'Fechado')
    .reduce((sum, l) => sum + (l.project_value || 0), 0) || 0;

  const taxaConversao = totalLeads > 0 ? ((fechados / totalLeads) * 100).toFixed(1) : '0.0';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Visão geral das suas métricas de vendas
        </p>
      </div>

      {/* Métricas Principais */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Novos Leads</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{novosLeads}</div>
            <p className="text-xs text-muted-foreground">Status: Lead novo</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Em Atendimento</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{emAtendimento}</div>
            <p className="text-xs text-muted-foreground">Status: Em contato</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Conversão</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{taxaConversao}%</div>
            <p className="text-xs text-muted-foreground">
              {fechados} de {totalLeads} leads
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Faturamento</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(faturamento)}</div>
            <p className="text-xs text-muted-foreground">Leads fechados</p>
          </CardContent>
        </Card>
      </div>

      {/* Funil de Vendas */}
      <Card>
        <CardHeader>
          <CardTitle>Funil de Vendas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              { label: 'Lead novo', count: novosLeads, color: 'bg-blue-500' },
              {
                label: 'Em contato',
                count: leads?.filter((l) => l.status === 'Em contato').length || 0,
                color: 'bg-yellow-500',
              },
              {
                label: 'Interessado',
                count: leads?.filter((l) => l.status === 'Interessado').length || 0,
                color: 'bg-orange-500',
              },
              {
                label: 'Proposta enviada',
                count: leads?.filter((l) => l.status === 'Proposta enviada').length || 0,
                color: 'bg-purple-500',
              },
              { label: 'Fechado', count: fechados, color: 'bg-green-500' },
            ].map((stage, i) => (
              <div key={i} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{stage.label}</span>
                  <span className="text-muted-foreground">{stage.count} leads</span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className={`h-full ${stage.color}`}
                    style={{
                      width: `${totalLeads > 0 ? (stage.count / totalLeads) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
