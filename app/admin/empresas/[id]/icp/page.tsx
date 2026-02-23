'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/use-toast';
import { ArrowLeft, Loader2 } from 'lucide-react';

export default function ICPConfigPage() {
  const params = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [config, setConfig] = useState({
    idade_min: 18,
    idade_max: 65,
    genero: '',
    escolaridade: '',
    nichos: ['Agricultura', 'Pecuária'],
    tamanho_empresas: '',
    tempo_mercado: '',
    empresa_funcionarios: 0,
    canais: ['WhatsApp', 'Email'],
    preferencia_contato: '',
    horario: '',
    linguagem: '',
    ciclo_compra: '',
    budget_min: 0,
    budget_max: 0,
    comprou_online: false,
    influenciador: false,
    leads_por_dia_max: 3,
    usar_ia: true,
    entregar_fins_semana: false,
    notificar_novos_leads: true,
    prioridade: 'Média',
    dores: '',
    objetivos: '',
  });

  const steps = [
    'Demográfico',
    'Empresa',
    'Comunicação',
    'Comportamento',
    'Dores e Objetivos',
    'Configurações',
  ];

  useEffect(() => {
    fetchICP();
  }, [params.id]);

  async function fetchICP() {
    try {
      const response = await fetch(`/api/admin/icp/${params.id}`);
      if (response.ok) {
        const data = await response.json();
        if (data.data) {
          setConfig(data.data);
        }
      }
    } catch (error) {
      console.error('Error fetching ICP:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/icp/${params.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.message);

      toast({ title: 'ICP configurado com sucesso!' });
      router.push(`/admin/empresas/${params.id}`);
    } catch (error: any) {
      toast({ title: error.message || 'Erro ao salvar ICP', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-96">
      <div className="animate-shimmer h-8 w-32 rounded-lg" />
    </div>;
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Configurar ICP</h1>
          <p className="text-muted-foreground mt-1">
            Etapa {currentStep + 1} de {steps.length}
          </p>
        </div>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {steps.map((step, index) => (
          <Button
            key={index}
            variant={currentStep === index ? 'default' : 'outline'}
            onClick={() => setCurrentStep(index)}
            className="flex-shrink-0 min-w-[40px]"
            size="sm"
          >
            <span className="md:hidden">{index + 1}</span>
            <span className="hidden md:inline">{index + 1}. {step}</span>
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{steps[currentStep]}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {currentStep === 0 && (
            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Idade Mínima</Label>
                  <Input
                    type="number"
                    value={config.idade_min}
                    onChange={(e) =>
                      setConfig({ ...config, idade_min: parseInt(e.target.value) })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Idade Máxima</Label>
                  <Input
                    type="number"
                    value={config.idade_max}
                    onChange={(e) =>
                      setConfig({ ...config, idade_max: parseInt(e.target.value) })
                    }
                  />
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Gênero</Label>
                  <Input
                    value={config.genero || ''}
                    onChange={(e) => setConfig({ ...config, genero: e.target.value })}
                    placeholder="Ex: Masculino, Feminino, Todos"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Escolaridade</Label>
                  <Input
                    value={config.escolaridade || ''}
                    onChange={(e) => setConfig({ ...config, escolaridade: e.target.value })}
                    placeholder="Ex: Superior Completo"
                  />
                </div>
              </div>
            </div>
          )}

          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tamanho da Empresa</Label>
                  <Input
                    value={config.tamanho_empresas || ''}
                    onChange={(e) =>
                      setConfig({ ...config, tamanho_empresas: e.target.value })
                    }
                    placeholder="Ex: Pequena, Média, Grande"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tempo de Mercado</Label>
                  <Input
                    value={config.tempo_mercado || ''}
                    onChange={(e) => setConfig({ ...config, tempo_mercado: e.target.value })}
                    placeholder="Ex: 1-5 anos, 5-10 anos"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Número de Funcionários</Label>
                <Input
                  type="number"
                  value={config.empresa_funcionarios || 0}
                  onChange={(e) =>
                    setConfig({ ...config, empresa_funcionarios: parseInt(e.target.value) || 0 })
                  }
                  placeholder="Ex: 50, 100, 500"
                />
              </div>
              <div className="space-y-2">
                <Label>Nichos (separados por vírgula)</Label>
                <Input
                  value={config.nichos?.join(', ') || ''}
                  onChange={(e) =>
                    setConfig({ ...config, nichos: e.target.value.split(',').map(n => n.trim()) })
                  }
                  placeholder="Ex: Agricultura, Pecuária, Tecnologia"
                />
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Canais de Comunicação Preferidos</Label>
                <Input
                  value={config.canais?.join(', ') || ''}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      canais: e.target.value.split(',').map(c => c.trim()),
                    })
                  }
                  placeholder="Ex: WhatsApp, Email, Telefone"
                />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Preferência de Contato</Label>
                  <Input
                    value={config.preferencia_contato || ''}
                    onChange={(e) =>
                      setConfig({ ...config, preferencia_contato: e.target.value })
                    }
                    placeholder="Ex: Manhã, Tarde, Noite"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Horário Preferido</Label>
                  <Input
                    value={config.horario || ''}
                    onChange={(e) => setConfig({ ...config, horario: e.target.value })}
                    placeholder="Ex: 9h-12h, 14h-18h"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Linguagem/Tom de Comunicação</Label>
                <Input
                  value={config.linguagem || ''}
                  onChange={(e) => setConfig({ ...config, linguagem: e.target.value })}
                  placeholder="Ex: Formal, Informal, Técnico"
                />
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Ciclo de Compra</Label>
                  <Input
                    value={config.ciclo_compra || ''}
                    onChange={(e) => setConfig({ ...config, ciclo_compra: e.target.value })}
                    placeholder="Ex: 30 dias, 60 dias, 90 dias"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Budget Mínimo (R$)</Label>
                  <Input
                    type="number"
                    value={config.budget_min || ''}
                    onChange={(e) =>
                      setConfig({ ...config, budget_min: parseInt(e.target.value) })
                    }
                    placeholder="Ex: 1000"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Budget Máximo (R$)</Label>
                <Input
                  type="number"
                  value={config.budget_max || ''}
                  onChange={(e) =>
                    setConfig({ ...config, budget_max: parseInt(e.target.value) })
                  }
                  placeholder="Ex: 10000"
                />
              </div>
              <div className="flex items-center justify-between border rounded-lg p-4">
                <div>
                  <Label>Já Comprou Online?</Label>
                  <p className="text-xs text-muted-foreground">
                    Cliente tem experiência com compras online
                  </p>
                </div>
                <Switch
                  checked={config.comprou_online || false}
                  onCheckedChange={(checked) =>
                    setConfig({ ...config, comprou_online: checked })
                  }
                />
              </div>
              <div className="flex items-center justify-between border rounded-lg p-4">
                <div>
                  <Label>Influenciado por Redes Sociais?</Label>
                  <p className="text-xs text-muted-foreground">
                    Cliente é ativo em redes sociais e influenciadores
                  </p>
                </div>
                <Switch
                  checked={config.influenciador || false}
                  onCheckedChange={(checked) =>
                    setConfig({ ...config, influenciador: checked })
                  }
                />
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Dores do Cliente</Label>
                <Textarea
                  value={config.dores}
                  onChange={(e) => setConfig({ ...config, dores: e.target.value })}
                  rows={4}
                  placeholder="Descreva as principais dores..."
                />
              </div>
              <div className="space-y-2">
                <Label>Objetivos</Label>
                <Textarea
                  value={config.objetivos}
                  onChange={(e) => setConfig({ ...config, objetivos: e.target.value })}
                  rows={4}
                  placeholder="Descreva os objetivos..."
                />
              </div>
            </div>
          )}

          {currentStep === 5 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Leads por Dia (Máximo)</Label>
                <Input
                  type="number"
                  value={config.leads_por_dia_max}
                  onChange={(e) =>
                    setConfig({ ...config, leads_por_dia_max: parseInt(e.target.value) })
                  }
                />
              </div>
              <div className="flex items-center justify-between border rounded-lg p-4">
                <div>
                  <Label>Usar IA para Qualificação</Label>
                  <p className="text-xs text-muted-foreground">
                    IA analisa e qualifica leads automaticamente
                  </p>
                </div>
                <Switch
                  checked={config.usar_ia}
                  onCheckedChange={(checked) => setConfig({ ...config, usar_ia: checked })}
                />
              </div>
              <div className="flex items-center justify-between border rounded-lg p-4">
                <div>
                  <Label>Entregar Fins de Semana</Label>
                  <p className="text-xs text-muted-foreground">
                    Enviar leads aos sábados e domingos
                  </p>
                </div>
                <Switch
                  checked={config.entregar_fins_semana}
                  onCheckedChange={(checked) =>
                    setConfig({ ...config, entregar_fins_semana: checked })
                  }
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        {currentStep > 0 && (
          <Button variant="outline" onClick={() => setCurrentStep(currentStep - 1)}>
            Anterior
          </Button>
        )}
        <div className="ml-auto space-x-2">
          {currentStep < steps.length - 1 ? (
            <Button onClick={() => setCurrentStep(currentStep + 1)}>Próximo</Button>
          ) : (
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar Configuração'
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
