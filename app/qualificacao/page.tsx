'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { ArrowRight, Loader2 } from 'lucide-react';
import {
  VOLUME_ATENDIMENTOS_OPTIONS,
  GARGALO_OPTIONS,
  PROCESSO_VENDAS_OPTIONS,
  URGENCIA_OPTIONS,
  BUDGET_OPTIONS,
  SEGMENTO_OPTIONS,
} from '@/types/lead-qualification';

export default function LeadQualificationPage() {
  const [currentStep, setCurrentStep] = useState(-1); // -1 = welcome screen
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const [formData, setFormData] = useState<Record<string, string>>({
    country_code: '+55',
  });

  const totalSteps = 11;
  const progress = currentStep === -1 ? 0 : ((currentStep + 1) / totalSteps) * 100;

  const updateField = (field: string, value: string) => {
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
        return !!formData.nome_completo;
      case 1:
        return !!formData.whatsapp && formData.whatsapp.length >= 10;
      case 2:
        return !!formData.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email);
      case 3:
        return !!formData.nome_empresa;
      case 4:
        return !!formData.segmento_negocio;
      case 5:
        return !!formData.volume_atendimentos;
      case 6:
        return !!formData.principal_gargalo;
      case 7:
        if (formData.principal_gargalo === 'outro') {
          return !!formData.dor_principal;
        }
        return true;
      case 8:
        return !!formData.processo_vendas;
      case 9:
        return !!formData.urgencia;
      case 10:
        return !!formData.budget;
      default:
        return true;
    }
  };

  const nextStep = () => {
    if (currentStep === -1) {
      setCurrentStep(0);
      return;
    }

    if (validateCurrentStep()) {
      // Skip step 7 (dor_principal) if gargalo is not 'outro'
      if (currentStep === 6 && formData.principal_gargalo !== 'outro') {
        setCurrentStep(8);
        return;
      }
      if (currentStep < totalSteps - 1) {
        setCurrentStep((prev) => prev + 1);
      }
    } else {
      toast({ title: 'Por favor, preencha este campo antes de continuar', variant: 'destructive' });
    }
  };

  const handleSubmit = async () => {
    if (!validateCurrentStep()) {
      toast({ title: 'Por favor, preencha todos os campos obrigatórios', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/lead-qualification/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Erro ao enviar formulário');
      }

      setIsSuccess(true);
      toast({ title: 'Formulário enviado com sucesso!' });
    } catch (error: any) {
      console.error('Error submitting form:', error);
      toast({ title: error.message || 'Erro ao enviar formulário', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isSubmitting) {
      if (currentStep === totalSteps - 1) {
        handleSubmit();
      } else {
        nextStep();
      }
    }
  };

  // Welcome Screen
  if (currentStep === -1) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-2xl w-full text-center space-y-8 animate-in fade-in duration-500">
          <div className="flex justify-center mb-8">
            <h1 className="text-3xl font-semibold">
              nexio<span className="text-primary">.</span>AI
            </h1>
          </div>
          <h1 className="text-4xl md:text-5xl font-semibold">
            Descubra como automatizar seu atendimento
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Responda algumas perguntas e veja como a Nexio AI pode transformar seu processo comercial
          </p>
          <Button size="lg" onClick={nextStep} className="text-base px-8 py-6">
            Começar
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </div>
    );
  }

  // Thank You Screen
  if (isSuccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-2xl w-full text-center space-y-8 animate-in fade-in duration-500">
          <h1 className="text-4xl md:text-5xl font-semibold">
            Obrigado pelo seu interesse!
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Recebemos suas informações e em breve um de nossos especialistas entrará em contato
            para apresentar a melhor solução para o seu negócio.
          </p>
          <Button
            size="lg"
            onClick={() => {
              const whatsapp = formData.whatsapp?.replace(/\D/g, '');
              window.open(`https://wa.me/${formData.country_code}${whatsapp}`, '_blank');
            }}
            className="text-lg px-8 py-6 bg-[#191919] hover:bg-[#2a2a2a]"
          >
            Abrir WhatsApp
          </Button>
        </div>
      </div>
    );
  }

  // Question Screens
  return (
    <div className="min-h-screen bg-background">
      {/* Fixed Logo */}
      <div className="fixed top-6 left-6 z-50">
        <h1 className="text-2xl font-bold">
          nexio<span className="text-primary">.</span>AI
        </h1>
      </div>

      {/* Progress Bar */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-muted z-50">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Question Content */}
      <div className="flex items-center justify-center min-h-screen p-4 pt-20">
        <div className="max-w-2xl w-full animate-in fade-in duration-300" onKeyPress={handleKeyPress}>
          {/* Question Number */}
          <div className="mb-4">
            <span className="text-sm text-muted-foreground">
              {currentStep + 1} → {totalSteps}
            </span>
          </div>

          {/* Step 0: Nome Completo */}
          {currentStep === 0 && (
            <div className="space-y-6">
              <h2 className="text-3xl md:text-4xl font-medium">
                Qual é o seu nome completo?
              </h2>
              <Input
                value={formData.nome_completo || ''}
                onChange={(e) => updateField('nome_completo', e.target.value)}
                placeholder="Digite seu nome..."
                className="text-xl h-14 bg-transparent border-0 border-b border-border rounded-none focus-visible:ring-0 focus-visible:border-primary px-0"
                autoFocus
              />
              <Button size="lg" onClick={nextStep} disabled={!formData.nome_completo}>
                OK <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          )}

          {/* Step 1: WhatsApp */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <h2 className="text-3xl md:text-4xl font-medium">
                Qual é o seu WhatsApp?
              </h2>
              <div className="flex gap-4">
                <Select
                  value={formData.country_code}
                  onValueChange={(value) => updateField('country_code', value)}
                >
                  <SelectTrigger className="w-32 h-14 text-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="+55">+55</SelectItem>
                    <SelectItem value="+1">+1</SelectItem>
                    <SelectItem value="+351">+351</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  value={formData.whatsapp || ''}
                  onChange={(e) => {
                    const formatted = formatWhatsApp(e.target.value);
                    updateField('whatsapp', formatted);
                  }}
                  placeholder="(14) 99999-9999"
                  className="text-xl h-14 bg-transparent border-0 border-b border-border rounded-none focus-visible:ring-0 focus-visible:border-primary px-0"
                  autoFocus
                />
              </div>
              <Button
                size="lg"
                onClick={nextStep}
                disabled={!formData.whatsapp || formData.whatsapp.length < 10}
              >
                OK <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          )}

          {/* Step 2: Email */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <h2 className="text-3xl md:text-4xl font-medium">
                Qual é o seu e-mail?
              </h2>
              <Input
                type="email"
                value={formData.email || ''}
                onChange={(e) => updateField('email', e.target.value)}
                placeholder="nome@empresa.com"
                className="text-xl h-14 bg-transparent border-0 border-b border-border rounded-none focus-visible:ring-0 focus-visible:border-primary px-0"
                autoFocus
              />
              <Button
                size="lg"
                onClick={nextStep}
                disabled={!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)}
              >
                OK <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          )}

          {/* Step 3: Nome da Empresa */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <h2 className="text-3xl md:text-4xl font-medium">
                Qual é o nome da sua empresa?
              </h2>
              <Input
                value={formData.nome_empresa || ''}
                onChange={(e) => updateField('nome_empresa', e.target.value)}
                placeholder="Digite o nome da empresa..."
                className="text-xl h-14 bg-transparent border-0 border-b border-border rounded-none focus-visible:ring-0 focus-visible:border-primary px-0"
                autoFocus
              />
              <Button size="lg" onClick={nextStep} disabled={!formData.nome_empresa}>
                OK <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          )}

          {/* Step 4: Segmento do Negócio */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <h2 className="text-3xl md:text-4xl font-medium">
                Qual é o segmento do seu negócio?
              </h2>
              <div className="space-y-3">
                {SEGMENTO_OPTIONS.map((segmento, index) => (
                  <button
                    key={segmento}
                    onClick={() => {
                      updateField('segmento_negocio', segmento);
                      setTimeout(nextStep, 300);
                    }}
                    className="w-full text-left p-4 rounded-lg border-2 border-border hover:border-primary hover:bg-accent transition-all flex items-center gap-4 group"
                  >
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-muted group-hover:bg-primary group-hover:text-primary-foreground flex items-center justify-center font-semibold">
                      {String.fromCharCode(65 + index)}
                    </div>
                    <span className="text-lg">{segmento}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 5: Volume de Atendimentos */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <h2 className="text-3xl md:text-4xl font-medium">
                Quantas conversas/atendimentos vocês fazem por dia no WhatsApp?
              </h2>
              <div className="space-y-3">
                {VOLUME_ATENDIMENTOS_OPTIONS.map((option, index) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      updateField('volume_atendimentos', option.value);
                      setTimeout(nextStep, 300);
                    }}
                    className="w-full text-left p-4 rounded-lg border-2 border-border hover:border-primary hover:bg-accent transition-all flex items-center gap-4 group"
                  >
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-muted group-hover:bg-primary group-hover:text-primary-foreground flex items-center justify-center font-semibold">
                      {String.fromCharCode(65 + index)}
                    </div>
                    <span className="text-lg">{option.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 6: Principal Gargalo */}
          {currentStep === 6 && (
            <div className="space-y-6">
              <h2 className="text-3xl md:text-4xl font-medium">
                Qual o principal gargalo no seu atendimento/vendas hoje?
              </h2>
              <div className="space-y-3">
                {GARGALO_OPTIONS.map((option, index) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      updateField('principal_gargalo', option.value);
                      if (option.value === 'outro') {
                        setTimeout(() => setCurrentStep(7), 300);
                      } else {
                        setTimeout(() => setCurrentStep(8), 300);
                      }
                    }}
                    className="w-full text-left p-4 rounded-lg border-2 border-border hover:border-primary hover:bg-accent transition-all flex items-center gap-4 group"
                  >
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-muted group-hover:bg-primary group-hover:text-primary-foreground flex items-center justify-center font-semibold">
                      {String.fromCharCode(65 + index)}
                    </div>
                    <span className="text-lg">{option.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 7: Dor Principal (apenas se gargalo === 'outro') */}
          {currentStep === 7 && (
            <div className="space-y-6">
              <h2 className="text-3xl md:text-4xl font-medium">
                Descreva brevemente sua dor principal
              </h2>
              <Textarea
                value={formData.dor_principal || ''}
                onChange={(e) => updateField('dor_principal', e.target.value)}
                placeholder="Conte-nos mais sobre o seu principal desafio..."
                className="text-lg min-h-[120px] bg-transparent border-2 border-border rounded-lg focus-visible:ring-0 focus-visible:border-primary"
                autoFocus
              />
              <Button size="lg" onClick={nextStep} disabled={!formData.dor_principal}>
                OK <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          )}

          {/* Step 8: Processo de Vendas */}
          {currentStep === 8 && (
            <div className="space-y-6">
              <h2 className="text-3xl md:text-4xl font-medium">
                Você já tem um processo de vendas estruturado?
              </h2>
              <div className="space-y-3">
                {PROCESSO_VENDAS_OPTIONS.map((option, index) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      updateField('processo_vendas', option.value);
                      setTimeout(nextStep, 300);
                    }}
                    className="w-full text-left p-4 rounded-lg border-2 border-border hover:border-primary hover:bg-accent transition-all flex items-center gap-4 group"
                  >
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-muted group-hover:bg-primary group-hover:text-primary-foreground flex items-center justify-center font-semibold">
                      {String.fromCharCode(65 + index)}
                    </div>
                    <span className="text-lg">{option.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 9: Urgência */}
          {currentStep === 9 && (
            <div className="space-y-6">
              <h2 className="text-3xl md:text-4xl font-medium">
                Quando você precisa resolver isso?
              </h2>
              <div className="space-y-3">
                {URGENCIA_OPTIONS.map((option, index) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      updateField('urgencia', option.value);
                      setTimeout(nextStep, 300);
                    }}
                    className="w-full text-left p-4 rounded-lg border-2 border-border hover:border-primary hover:bg-accent transition-all flex items-center gap-4 group"
                  >
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-muted group-hover:bg-primary group-hover:text-primary-foreground flex items-center justify-center font-semibold">
                      {String.fromCharCode(65 + index)}
                    </div>
                    <span className="text-lg">{option.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 10: Budget */}
          {currentStep === 10 && (
            <div className="space-y-6">
              <h2 className="text-3xl md:text-4xl font-medium">
                Qual seu budget disponível para investir em uma solução completa?
              </h2>
              <div className="space-y-3">
                {BUDGET_OPTIONS.map((option, index) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      updateField('budget', option.value);
                      setTimeout(() => handleSubmit(), 300);
                    }}
                    className="w-full text-left p-4 rounded-lg border-2 border-border hover:border-primary hover:bg-accent transition-all flex items-center gap-4 group"
                    disabled={isSubmitting}
                  >
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-muted group-hover:bg-primary group-hover:text-primary-foreground flex items-center justify-center font-semibold">
                      {String.fromCharCode(65 + index)}
                    </div>
                    <span className="text-lg">{option.label}</span>
                    {isSubmitting && <Loader2 className="ml-auto h-5 w-5 animate-spin" />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
