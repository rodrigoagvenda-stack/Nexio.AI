'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Loader2, Save, Target } from 'lucide-react';

interface Plan {
  id: number;
  name: string;
  extraction_limit: number;
  mql_percentage: number;
  description?: string;
}

export default function AdminPlanosPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);

  useEffect(() => {
    fetchPlans();
  }, []);

  async function fetchPlans() {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('plans')
        .select('*')
        .order('id');

      if (error) throw error;
      setPlans(data || []);
    } catch (error) {
      console.error('Error fetching plans:', error);
      toast.error('Erro ao carregar planos');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(plan: Plan) {
    setSaving(plan.id);
    try {
      const supabase = createClient();

      // Calcular MQLs e leads normais
      const totalLeads = plan.extraction_limit;
      const mqls = Math.floor((totalLeads * plan.mql_percentage) / 100);
      const normalLeads = totalLeads - mqls;

      const updatedDescription = `Receba ${totalLeads} leads por mês, sendo ${plan.mql_percentage}% MQLs (${mqls} MQLs + ${normalLeads} leads normais)`;

      const { error } = await supabase
        .from('plans')
        .update({
          name: plan.name,
          extraction_limit: plan.extraction_limit,
          mql_percentage: plan.mql_percentage,
          description: updatedDescription,
        })
        .eq('id', plan.id);

      if (error) throw error;

      toast.success('Plano atualizado com sucesso!');
      await fetchPlans();
    } catch (error) {
      console.error('Error saving plan:', error);
      toast.error('Erro ao salvar plano');
    } finally {
      setSaving(null);
    }
  }

  function updatePlan(id: number, field: keyof Plan, value: any) {
    setPlans(plans.map(p =>
      p.id === id ? { ...p, [field]: value } : p
    ));
  }

  function calculateMQLs(totalLeads: number, percentage: number) {
    return Math.floor((totalLeads * percentage) / 100);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Gerenciar Planos</h1>
        <p className="text-muted-foreground mt-1">
          Configure os limites de extração e porcentagem de MQLs (Marketing Qualified Leads) para cada plano
        </p>
      </div>

      <div className="grid gap-6">
        {plans.map((plan) => {
          const mqls = calculateMQLs(plan.extraction_limit, plan.mql_percentage);
          const normalLeads = plan.extraction_limit - mqls;

          return (
            <Card key={plan.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" />
                  {plan.name}
                </CardTitle>
                <CardDescription>
                  Configuração de limites e MQLs do plano
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor={`name-${plan.id}`}>Nome do Plano</Label>
                    <Input
                      id={`name-${plan.id}`}
                      value={plan.name}
                      onChange={(e) => updatePlan(plan.id, 'name', e.target.value)}
                      placeholder="Ex: Agro Inteligente"
                    />
                  </div>

                  <div>
                    <Label htmlFor={`limit-${plan.id}`}>
                      Total de Leads/Mês
                    </Label>
                    <Input
                      id={`limit-${plan.id}`}
                      type="number"
                      value={plan.extraction_limit}
                      onChange={(e) => updatePlan(plan.id, 'extraction_limit', parseInt(e.target.value) || 0)}
                      placeholder="Ex: 70"
                    />
                  </div>

                  <div>
                    <Label htmlFor={`mql-${plan.id}`}>
                      Porcentagem de MQLs (%)
                    </Label>
                    <Input
                      id={`mql-${plan.id}`}
                      type="number"
                      min="0"
                      max="100"
                      value={plan.mql_percentage}
                      onChange={(e) => updatePlan(plan.id, 'mql_percentage', parseInt(e.target.value) || 0)}
                      placeholder="Ex: 70"
                    />
                  </div>

                  <div className="flex items-end">
                    <Button
                      onClick={() => handleSave(plan)}
                      disabled={saving === plan.id}
                      className="w-full"
                    >
                      {saving === plan.id ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Salvando...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          Salvar
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Preview da distribuição */}
                <div className="bg-primary/5 p-4 rounded-lg space-y-2">
                  <h4 className="font-semibold text-sm">Distribuição de Leads:</h4>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Total</p>
                      <p className="text-2xl font-bold text-primary">{plan.extraction_limit}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">MQLs ({plan.mql_percentage}%)</p>
                      <p className="text-2xl font-bold text-green-600">{mqls}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Leads Normais</p>
                      <p className="text-2xl font-bold text-blue-600">{normalLeads}</p>
                    </div>
                  </div>
                </div>

                {/* Descrição auto-gerada */}
                <div>
                  <Label className="text-xs text-muted-foreground">Descrição (Auto-gerada)</Label>
                  <p className="text-sm mt-1 p-3 bg-muted rounded">
                    Receba {plan.extraction_limit} leads por mês, sendo {plan.mql_percentage}% MQLs
                    ({mqls} MQLs + {normalLeads} leads normais)
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Explicação sobre MQLs */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-blue-900">O que são MQLs?</CardTitle>
        </CardHeader>
        <CardContent className="text-blue-800">
          <p className="text-sm">
            <strong>MQL (Marketing Qualified Lead)</strong> são leads que foram qualificados pelo time de marketing
            e têm maior probabilidade de conversão em clientes. Eles demonstraram interesse genuíno nos produtos/serviços
            através de interações específicas e atendem aos critérios do ICP (Perfil de Cliente Ideal).
          </p>
          <p className="text-sm mt-2">
            A porcentagem de MQLs indica quantos dos leads extraídos mensalmente serão de alta qualidade,
            já pré-qualificados e prontos para abordagem comercial.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
