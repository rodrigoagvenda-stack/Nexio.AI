'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { ArrowRight, Loader2 } from 'lucide-react';
import { BriefingFormData } from '@/types/briefing';

export default function BriefPage() {
  const [currentStep, setCurrentStep] = useState(-1); // -1 = welcome screen
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const [formData, setFormData] = useState<Partial<BriefingFormData>>({
    country_code: '+55',
    investe_marketing: 'nao',
  });

  const totalSteps = 12;
  const progress = currentStep === -1 ? 0 : ((currentStep + 1) / totalSteps) * 100;

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
        return true;
      case 5:
        return true;
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
    if (currentStep === -1) {
      setCurrentStep(0);
      return;
    }

    if (validateCurrentStep()) {
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
      toast({ title: 'Briefing enviado com sucesso!' });
    } catch (error: any) {
      console.error('Error submitting briefing:', error);
      toast({ title: error.message || 'Erro ao enviar briefing', variant: 'destructive' });
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
              nexio<span className="text-primary">.</span>ai
            </h1>
          </div>
          <h1 className="text-4xl md:text-5xl font-semibold">
            Bem-vindo ao Briefing
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Vamos conhecer melhor a sua empresa e entender como podemos ajudar a alavancar seus resultados
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
            Briefing Enviado!
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Obrigado por preencher nosso briefing. Em breve entraremos em contato via WhatsApp para discutir os próximos passos!
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
          nexio<span className="text-primary">.</span>ai
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

          {/* Step 0: Nome */}
          {currentStep === 0 && (
            <div className="space-y-6">
              <h2 className="text-3xl md:text-4xl font-medium">
                Qual é o seu nome completo?
              </h2>
              <Input
                value={formData.nome_responsavel || ''}
                onChange={(e) => updateField('nome_responsavel', e.target.value)}
                placeholder="Digite seu nome..."
                className="text-xl h-14 bg-transparent border-0 border-b border-border rounded-none focus-visible:ring-0 focus-visible:border-primary px-0"
                autoFocus
              />
              <Button size="lg" onClick={nextStep} disabled={!formData.nome_responsavel}>
                OK <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          )}

          {/* Step 1: Email */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <h2 className="text-3xl md:text-4xl font-medium">
                Qual é o seu email?
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

          {/* Step 2: WhatsApp */}
          {currentStep === 2 && (
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
                    <SelectItem value="+55">🇧🇷 +55</SelectItem>
                    <SelectItem value="+1">🇺🇸 +1</SelectItem>
                    <SelectItem value="+351">🇵🇹 +351</SelectItem>
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

          {/* Step 4: Site */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <h2 className="text-3xl md:text-4xl font-medium">
                Qual é o site da sua empresa?
              </h2>
              <p className="text-muted-foreground">Opcional - pressione OK para pular</p>
              <Input
                type="url"
                value={formData.site || ''}
                onChange={(e) => updateField('site', e.target.value)}
                placeholder="www.empresax.com.br"
                className="text-xl h-14 bg-transparent border-0 border-b border-border rounded-none focus-visible:ring-0 focus-visible:border-primary px-0"
                autoFocus
              />
              <Button size="lg" onClick={nextStep}>
                OK <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          )}

          {/* Step 5: Instagram */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <h2 className="text-3xl md:text-4xl font-medium">
                Qual é o Instagram da sua empresa?
              </h2>
              <p className="text-muted-foreground">Opcional - pressione OK para pular</p>
              <Input
                value={formData.instagram || ''}
                onChange={(e) => updateField('instagram', e.target.value)}
                placeholder="@empresax"
                className="text-xl h-14 bg-transparent border-0 border-b border-border rounded-none focus-visible:ring-0 focus-visible:border-primary px-0"
                autoFocus
              />
              <Button size="lg" onClick={nextStep}>
                OK <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          )}

          {/* Step 6: Segmento */}
          {currentStep === 6 && (
            <div className="space-y-6">
              <h2 className="text-3xl md:text-4xl font-medium">
                Qual é o segmento da sua empresa?
              </h2>
              <div className="space-y-3">
                {[
                  { value: 'E-commerce', label: 'E-commerce' },
                  { value: 'Serviços', label: 'Serviços' },
                  { value: 'Varejo', label: 'Varejo' },
                  { value: 'Indústria', label: 'Indústria' },
                  { value: 'Tecnologia', label: 'Tecnologia' },
                  { value: 'Saúde', label: 'Saúde' },
                  { value: 'Educação', label: 'Educação' },
                  { value: 'Outro', label: 'Outro' },
                ].map((option, index) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      updateField('segmento', option.value);
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

          {/* Step 7: Tempo de Mercado */}
          {currentStep === 7 && (
            <div className="space-y-6">
              <h2 className="text-3xl md:text-4xl font-medium">
                Há quanto tempo está no mercado?
              </h2>
              <div className="space-y-3">
                {[
                  { value: 'menos-1-ano', label: 'Menos de 1 ano' },
                  { value: '1-3-anos', label: '1 a 3 anos' },
                  { value: '3-5-anos', label: '3 a 5 anos' },
                  { value: '5-10-anos', label: '5 a 10 anos' },
                  { value: 'mais-10-anos', label: 'Mais de 10 anos' },
                ].map((option, index) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      updateField('tempo_mercado', option.value);
                      setTimeout(nextStep, 300);
                    }}
                    className="w-full text-left p-4 rounded-lg border-2 border-border hover:border-primary hover:bg-accent transition-all flex items-center gap-4 group"
                  >
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-muted group-hover:bg-primary group-hover:text-primary-foreground flex items-center justify-center font-bold">
                      {String.fromCharCode(65 + index)}
                    </div>
                    <span className="text-lg">{option.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 8: Investe em Marketing */}
          {currentStep === 8 && (
            <div className="space-y-6">
              <h2 className="text-3xl md:text-4xl font-medium">
                Já investe em marketing digital?
              </h2>
              <div className="space-y-3">
                {[
                  { value: 'sim', label: 'Sim' },
                  { value: 'nao', label: 'Não' },
                ].map((option, index) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      updateField('investe_marketing', option.value);
                      setTimeout(nextStep, 300);
                    }}
                    className="w-full text-left p-4 rounded-lg border-2 border-border hover:border-primary hover:bg-accent transition-all flex items-center gap-4 group"
                  >
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-muted group-hover:bg-primary group-hover:text-primary-foreground flex items-center justify-center font-bold">
                      {String.fromCharCode(65 + index)}
                    </div>
                    <span className="text-lg">{option.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 9: Resultados ou Objetivo */}
          {currentStep === 9 && formData.investe_marketing === 'sim' && (
            <div className="space-y-6">
              <h2 className="text-3xl md:text-4xl font-medium">
                Como você avalia os resultados atuais?
              </h2>
              <div className="space-y-3">
                {[
                  { value: 'excelente', label: 'Excelente' },
                  { value: 'bom', label: 'Bom' },
                  { value: 'regular', label: 'Regular' },
                  { value: 'ruim', label: 'Ruim' },
                ].map((option, index) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      updateField('resultados', option.value);
                      setTimeout(nextStep, 300);
                    }}
                    className="w-full text-left p-4 rounded-lg border-2 border-border hover:border-primary hover:bg-accent transition-all flex items-center gap-4 group"
                  >
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-muted group-hover:bg-primary group-hover:text-primary-foreground flex items-center justify-center font-bold">
                      {String.fromCharCode(65 + index)}
                    </div>
                    <span className="text-lg">{option.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {currentStep === 9 && formData.investe_marketing === 'nao' && (
            <div className="space-y-6">
              <h2 className="text-3xl md:text-4xl font-medium">
                Qual é o principal objetivo?
              </h2>
              <div className="space-y-3">
                {[
                  { value: 'aumentar-vendas', label: 'Aumentar vendas' },
                  { value: 'gerar-leads', label: 'Gerar leads' },
                  { value: 'fortalecer-marca', label: 'Fortalecer marca' },
                  { value: 'engajamento', label: 'Aumentar engajamento' },
                ].map((option, index) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      updateField('objetivo', option.value);
                      setTimeout(nextStep, 300);
                    }}
                    className="w-full text-left p-4 rounded-lg border-2 border-border hover:border-primary hover:bg-accent transition-all flex items-center gap-4 group"
                  >
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-muted group-hover:bg-primary group-hover:text-primary-foreground flex items-center justify-center font-bold">
                      {String.fromCharCode(65 + index)}
                    </div>
                    <span className="text-lg">{option.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 10: Faturamento */}
          {currentStep === 10 && (
            <div className="space-y-6">
              <h2 className="text-3xl md:text-4xl font-medium">
                Qual é o faturamento mensal médio?
              </h2>
              <div className="space-y-3">
                {[
                  { value: 'ate-10k', label: 'Até R$ 10k' },
                  { value: '10k-50k', label: 'R$ 10k - R$ 50k' },
                  { value: '50k-100k', label: 'R$ 50k - R$ 100k' },
                  { value: '100k-500k', label: 'R$ 100k - R$ 500k' },
                  { value: 'acima-500k', label: 'Acima de R$ 500k' },
                ].map((option, index) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      updateField('faturamento', option.value);
                      setTimeout(nextStep, 300);
                    }}
                    className="w-full text-left p-4 rounded-lg border-2 border-border hover:border-primary hover:bg-accent transition-all flex items-center gap-4 group"
                  >
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-muted group-hover:bg-primary group-hover:text-primary-foreground flex items-center justify-center font-bold">
                      {String.fromCharCode(65 + index)}
                    </div>
                    <span className="text-lg">{option.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 11: Budget */}
          {currentStep === 11 && (
            <div className="space-y-6">
              <h2 className="text-3xl md:text-4xl font-medium">
                Qual o budget para marketing digital?
              </h2>
              <div className="space-y-3">
                {[
                  { value: 'ate-2k', label: 'Até R$ 2k' },
                  { value: '2k-5k', label: 'R$ 2k - R$ 5k' },
                  { value: '5k-8k', label: 'R$ 5k - R$ 8k' },
                  { value: '8k-20k', label: 'R$ 8k - R$ 20k' },
                  { value: 'acima-20k', label: 'Acima de R$ 20k' },
                ].map((option, index) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      updateField('budget', option.value);
                      setTimeout(() => handleSubmit(), 300);
                    }}
                    className="w-full text-left p-4 rounded-lg border-2 border-border hover:border-primary hover:bg-accent transition-all flex items-center gap-4 group"
                    disabled={isSubmitting}
                  >
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-muted group-hover:bg-primary group-hover:text-primary-foreground flex items-center justify-center font-bold">
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
