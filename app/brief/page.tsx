'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { ArrowRight, ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';
import { BriefingFormData } from '@/types/briefing';

export default function BriefPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const [formData, setFormData] = useState<Partial<BriefingFormData>>({
    country_code: '+55',
    investe_marketing: 'nao',
  });

  const totalSteps = 12;
  const progress = ((currentStep + 1) / totalSteps) * 100;

  const updateField = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const formatWhatsApp = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length <= 10) {
      return cleaned.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
    }
    return cleaned.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
  };

  const validateCurrentStep = () => {
    switch (currentStep) {
      case 0:
        return !!formData.nome_responsavel;
      case 1:
        return !!formData.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email);
      case 2:
        return !!formData.whatsapp && formData.whatsapp.length >= 10;
      case 3:
        return !!formData.nome_empresa;
      case 4:
        return true; // site é opcional
      case 5:
        return true; // instagram é opcional
      case 6:
        return !!formData.segmento;
      case 7:
        return !!formData.tempo_mercado;
      case 8:
        return !!formData.investe_marketing;
      case 9:
        if (formData.investe_marketing === 'sim') {
          return !!formData.resultados;
        } else {
          return !!formData.objetivo;
        }
      case 10:
        return !!formData.faturamento;
      case 11:
        return !!formData.budget;
      default:
        return true;
    }
  };

  const nextStep = () => {
    if (validateCurrentStep()) {
      if (currentStep < totalSteps - 1) {
        setCurrentStep((prev) => prev + 1);
      }
    } else {
      toast.error('Por favor, preencha este campo antes de continuar');
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleSubmit = async () => {
    if (!validateCurrentStep()) {
      toast.error('Por favor, preencha todos os campos obrigatórios');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/briefing/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Erro ao enviar briefing');
      }

      setIsSuccess(true);
      toast.success('Briefing enviado com sucesso!');
    } catch (error: any) {
      console.error('Error submitting briefing:', error);
      toast.error(error.message || 'Erro ao enviar briefing');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <CheckCircle2 className="h-16 w-16 text-green-500" />
              <h2 className="text-2xl font-bold text-center">Briefing Enviado!</h2>
              <p className="text-muted-foreground text-center">
                Obrigado por preencher nosso briefing. Em breve entraremos em contato!
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="flex items-center justify-between mb-4">
            <div>
              <CardTitle className="text-2xl">Briefing de Projeto</CardTitle>
              <CardDescription>
                Etapa {currentStep + 1} de {totalSteps}
              </CardDescription>
            </div>
            <div className="text-primary font-bold text-lg">{Math.round(progress)}%</div>
          </div>
          <Progress value={progress} />
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Etapa 0: Nome do Responsável */}
          {currentStep === 0 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="nome_responsavel" className="text-lg">
                  Qual é o seu nome completo? *
                </Label>
                <Input
                  id="nome_responsavel"
                  value={formData.nome_responsavel || ''}
                  onChange={(e) => updateField('nome_responsavel', e.target.value)}
                  placeholder="João Silva Santos"
                  className="mt-2 text-lg h-12"
                  autoFocus
                />
              </div>
            </div>
          )}

          {/* Etapa 1: Email */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="email" className="text-lg">
                  Qual é o seu email? *
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => updateField('email', e.target.value)}
                  placeholder="joao@empresa.com"
                  className="mt-2 text-lg h-12"
                  autoFocus
                />
              </div>
            </div>
          )}

          {/* Etapa 2: WhatsApp */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="whatsapp" className="text-lg">
                  Qual é o seu WhatsApp? *
                </Label>
                <div className="flex gap-2 mt-2">
                  <Select
                    value={formData.country_code}
                    onValueChange={(value) => updateField('country_code', value)}
                  >
                    <SelectTrigger className="w-24 h-12">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="+55">🇧🇷 +55</SelectItem>
                      <SelectItem value="+1">🇺🇸 +1</SelectItem>
                      <SelectItem value="+351">🇵🇹 +351</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    id="whatsapp"
                    value={formData.whatsapp || ''}
                    onChange={(e) => {
                      const formatted = formatWhatsApp(e.target.value);
                      updateField('whatsapp', formatted);
                    }}
                    placeholder="(14) 99999-9999"
                    className="text-lg h-12"
                    autoFocus
                  />
                </div>
              </div>
            </div>
          )}

          {/* Etapa 3: Nome da Empresa */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="nome_empresa" className="text-lg">
                  Qual é o nome da sua empresa? *
                </Label>
                <Input
                  id="nome_empresa"
                  value={formData.nome_empresa || ''}
                  onChange={(e) => updateField('nome_empresa', e.target.value)}
                  placeholder="Empresa X Ltda"
                  className="mt-2 text-lg h-12"
                  autoFocus
                />
              </div>
            </div>
          )}

          {/* Etapa 4: Site */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="site" className="text-lg">
                  Qual é o site da sua empresa?
                </Label>
                <Input
                  id="site"
                  type="url"
                  value={formData.site || ''}
                  onChange={(e) => updateField('site', e.target.value)}
                  placeholder="www.empresax.com.br"
                  className="mt-2 text-lg h-12"
                  autoFocus
                />
                <p className="text-sm text-muted-foreground mt-2">Opcional</p>
              </div>
            </div>
          )}

          {/* Etapa 5: Instagram */}
          {currentStep === 5 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="instagram" className="text-lg">
                  Qual é o Instagram da sua empresa?
                </Label>
                <Input
                  id="instagram"
                  value={formData.instagram || ''}
                  onChange={(e) => updateField('instagram', e.target.value)}
                  placeholder="@empresax"
                  className="mt-2 text-lg h-12"
                  autoFocus
                />
                <p className="text-sm text-muted-foreground mt-2">Opcional</p>
              </div>
            </div>
          )}

          {/* Etapa 6: Segmento */}
          {currentStep === 6 && (
            <div className="space-y-4">
              <div>
                <Label className="text-lg">Qual é o segmento da sua empresa? *</Label>
                <Select
                  value={formData.segmento}
                  onValueChange={(value) => updateField('segmento', value)}
                >
                  <SelectTrigger className="mt-2 h-12 text-lg">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="E-commerce">E-commerce</SelectItem>
                    <SelectItem value="Serviços">Serviços</SelectItem>
                    <SelectItem value="Varejo">Varejo</SelectItem>
                    <SelectItem value="Indústria">Indústria</SelectItem>
                    <SelectItem value="Tecnologia">Tecnologia</SelectItem>
                    <SelectItem value="Saúde">Saúde</SelectItem>
                    <SelectItem value="Educação">Educação</SelectItem>
                    <SelectItem value="Outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Etapa 7: Tempo de Mercado */}
          {currentStep === 7 && (
            <div className="space-y-4">
              <div>
                <Label className="text-lg">Há quanto tempo está no mercado? *</Label>
                <Select
                  value={formData.tempo_mercado}
                  onValueChange={(value) => updateField('tempo_mercado', value)}
                >
                  <SelectTrigger className="mt-2 h-12 text-lg">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="menos-1-ano">Menos de 1 ano</SelectItem>
                    <SelectItem value="1-3-anos">1 a 3 anos</SelectItem>
                    <SelectItem value="3-5-anos">3 a 5 anos</SelectItem>
                    <SelectItem value="5-10-anos">5 a 10 anos</SelectItem>
                    <SelectItem value="mais-10-anos">Mais de 10 anos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Etapa 8: Investe em Marketing */}
          {currentStep === 8 && (
            <div className="space-y-4">
              <div>
                <Label className="text-lg">Já investe em marketing digital? *</Label>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <Button
                    type="button"
                    variant={formData.investe_marketing === 'sim' ? 'default' : 'outline'}
                    className="h-16 text-lg"
                    onClick={() => updateField('investe_marketing', 'sim')}
                  >
                    Sim
                  </Button>
                  <Button
                    type="button"
                    variant={formData.investe_marketing === 'nao' ? 'default' : 'outline'}
                    className="h-16 text-lg"
                    onClick={() => updateField('investe_marketing', 'nao')}
                  >
                    Não
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Etapa 9: Resultados ou Objetivo */}
          {currentStep === 9 && formData.investe_marketing === 'sim' && (
            <div className="space-y-4">
              <div>
                <Label className="text-lg">Como você avalia os resultados atuais? *</Label>
                <Select
                  value={formData.resultados}
                  onValueChange={(value) => updateField('resultados', value)}
                >
                  <SelectTrigger className="mt-2 h-12 text-lg">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="excelente">Excelente</SelectItem>
                    <SelectItem value="bom">Bom</SelectItem>
                    <SelectItem value="regular">Regular</SelectItem>
                    <SelectItem value="ruim">Ruim</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {currentStep === 9 && formData.investe_marketing === 'nao' && (
            <div className="space-y-4">
              <div>
                <Label className="text-lg">Qual é o principal objetivo? *</Label>
                <Select
                  value={formData.objetivo}
                  onValueChange={(value) => updateField('objetivo', value)}
                >
                  <SelectTrigger className="mt-2 h-12 text-lg">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aumentar-vendas">Aumentar vendas</SelectItem>
                    <SelectItem value="gerar-leads">Gerar leads</SelectItem>
                    <SelectItem value="fortalecer-marca">Fortalecer marca</SelectItem>
                    <SelectItem value="engajamento">Aumentar engajamento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Etapa 10: Faturamento */}
          {currentStep === 10 && (
            <div className="space-y-4">
              <div>
                <Label className="text-lg">Qual é o faturamento mensal médio? *</Label>
                <Select
                  value={formData.faturamento}
                  onValueChange={(value) => updateField('faturamento', value)}
                >
                  <SelectTrigger className="mt-2 h-12 text-lg">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ate-10k">Até R$ 10k</SelectItem>
                    <SelectItem value="10k-50k">R$ 10k - R$ 50k</SelectItem>
                    <SelectItem value="50k-100k">R$ 50k - R$ 100k</SelectItem>
                    <SelectItem value="100k-500k">R$ 100k - R$ 500k</SelectItem>
                    <SelectItem value="acima-500k">Acima de R$ 500k</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Etapa 11: Budget */}
          {currentStep === 11 && (
            <div className="space-y-4">
              <div>
                <Label className="text-lg">Qual o budget para marketing digital? *</Label>
                <Select
                  value={formData.budget}
                  onValueChange={(value) => updateField('budget', value)}
                >
                  <SelectTrigger className="mt-2 h-12 text-lg">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ate-2k">Até R$ 2k</SelectItem>
                    <SelectItem value="2k-5k">R$ 2k - R$ 5k</SelectItem>
                    <SelectItem value="5k-8k">R$ 5k - R$ 8k</SelectItem>
                    <SelectItem value="8k-20k">R$ 8k - R$ 20k</SelectItem>
                    <SelectItem value="acima-20k">Acima de R$ 20k</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Botões de Navegação */}
          <div className="flex justify-between pt-4">
            {currentStep > 0 && (
              <Button variant="outline" onClick={prevStep} disabled={isSubmitting}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar
              </Button>
            )}
            <div className="ml-auto">
              {currentStep < totalSteps - 1 ? (
                <Button onClick={nextStep} disabled={isSubmitting}>
                  Próximo
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={handleSubmit} disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    'Enviar Briefing'
                  )}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
