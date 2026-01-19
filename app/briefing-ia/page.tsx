'use client';

import { useState } from 'react';
import { OrbitCard, OrbitCardContent, OrbitCardDescription, OrbitCardHeader, OrbitCardTitle } from '@/components/ui/orbit-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, Sparkles, Building2, TrendingUp, DollarSign, Target, Clock, Mail, Phone, Globe, Instagram as InstagramIcon } from 'lucide-react';
import { BriefingFormData } from '@/types/briefing';
import { cn } from '@/lib/utils/cn';

export default function BriefingIAPage() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState<BriefingFormData>({
    nome_responsavel: '',
    email: '',
    whatsapp: '',
    country_code: '+55',
    nome_empresa: '',
    site: '',
    instagram: '',
    segmento: '',
    tempo_mercado: '',
    investe_marketing: 'nao',
    resultados: '',
    objetivo: '',
    faturamento: '',
    budget: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/briefing/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.message);

      setSuccess(true);
      toast.success('Briefing enviado com sucesso!');

      // Reset form after 3 seconds
      setTimeout(() => {
        setFormData({
          nome_responsavel: '',
          email: '',
          whatsapp: '',
          country_code: '+55',
          nome_empresa: '',
          site: '',
          instagram: '',
          segmento: '',
          tempo_mercado: '',
          investe_marketing: 'nao',
          resultados: '',
          objetivo: '',
          faturamento: '',
          budget: '',
        });
        setSuccess(false);
      }, 3000);
    } catch (error: any) {
      console.error('Error submitting briefing:', error);
      toast.error(error.message || 'Erro ao enviar briefing');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-background flex items-center justify-center p-6">
        <OrbitCard className="max-w-md w-full text-center">
          <OrbitCardContent className="pt-12 pb-12">
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse" />
                <CheckCircle2 className="h-20 w-20 text-primary relative" />
              </div>
            </div>
            <h2 className="text-3xl font-bold mb-3">Briefing Enviado!</h2>
            <p className="text-muted-foreground text-lg">
              Recebemos suas informações e entraremos em contato em breve.
            </p>
          </OrbitCardContent>
        </OrbitCard>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-background py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 mb-4 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
            <Sparkles className="h-5 w-5 text-primary" />
            <span className="text-sm font-semibold text-primary">Briefing Inteligente</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Vamos conhecer sua <span className="text-primary">empresa</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Preencha este formulário para que possamos entender suas necessidades e criar uma estratégia personalizada para o seu negócio.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Informações de Contato */}
          <OrbitCard gradient="from-blue-500/10 via-transparent to-transparent">
            <OrbitCardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <Mail className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <OrbitCardTitle>Informações de Contato</OrbitCardTitle>
                  <OrbitCardDescription>Como podemos entrar em contato com você?</OrbitCardDescription>
                </div>
              </div>
            </OrbitCardHeader>
            <OrbitCardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nome_responsavel">Nome Completo *</Label>
                  <Input
                    id="nome_responsavel"
                    placeholder="João Silva"
                    value={formData.nome_responsavel}
                    onChange={(e) => setFormData({ ...formData, nome_responsavel: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="joao@empresa.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="country_code">Código</Label>
                  <Select
                    value={formData.country_code}
                    onValueChange={(value) => setFormData({ ...formData, country_code: value })}
                  >
                    <SelectTrigger id="country_code">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="+55">🇧🇷 +55</SelectItem>
                      <SelectItem value="+1">🇺🇸 +1</SelectItem>
                      <SelectItem value="+351">🇵🇹 +351</SelectItem>
                      <SelectItem value="+54">🇦🇷 +54</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="whatsapp">WhatsApp *</Label>
                  <Input
                    id="whatsapp"
                    placeholder="(11) 99999-9999"
                    value={formData.whatsapp}
                    onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                    required
                  />
                </div>
              </div>
            </OrbitCardContent>
          </OrbitCard>

          {/* Informações da Empresa */}
          <OrbitCard gradient="from-purple-500/10 via-transparent to-transparent">
            <OrbitCardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/10 rounded-lg">
                  <Building2 className="h-5 w-5 text-purple-400" />
                </div>
                <div>
                  <OrbitCardTitle>Sobre a Empresa</OrbitCardTitle>
                  <OrbitCardDescription>Conte-nos mais sobre seu negócio</OrbitCardDescription>
                </div>
              </div>
            </OrbitCardHeader>
            <OrbitCardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nome_empresa">Nome da Empresa *</Label>
                <Input
                  id="nome_empresa"
                  placeholder="Minha Empresa Ltda"
                  value={formData.nome_empresa}
                  onChange={(e) => setFormData({ ...formData, nome_empresa: e.target.value })}
                  required
                />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="site">Site</Label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="site"
                      placeholder="www.minhaempresa.com"
                      className="pl-10"
                      value={formData.site || ''}
                      onChange={(e) => setFormData({ ...formData, site: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="instagram">Instagram</Label>
                  <div className="relative">
                    <InstagramIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="instagram"
                      placeholder="@minhaempresa"
                      className="pl-10"
                      value={formData.instagram || ''}
                      onChange={(e) => setFormData({ ...formData, instagram: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="segmento">Segmento/Nicho *</Label>
                  <Input
                    id="segmento"
                    placeholder="Ex: E-commerce de moda"
                    value={formData.segmento}
                    onChange={(e) => setFormData({ ...formData, segmento: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tempo_mercado">Tempo de Mercado *</Label>
                  <Select
                    value={formData.tempo_mercado}
                    onValueChange={(value) => setFormData({ ...formData, tempo_mercado: value })}
                    required
                  >
                    <SelectTrigger id="tempo_mercado">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="menos-1ano">Menos de 1 ano</SelectItem>
                      <SelectItem value="1-3anos">1 a 3 anos</SelectItem>
                      <SelectItem value="3-5anos">3 a 5 anos</SelectItem>
                      <SelectItem value="5-10anos">5 a 10 anos</SelectItem>
                      <SelectItem value="mais-10anos">Mais de 10 anos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </OrbitCardContent>
          </OrbitCard>

          {/* Marketing Atual */}
          <OrbitCard gradient="from-orange-500/10 via-transparent to-transparent">
            <OrbitCardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-500/10 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-orange-400" />
                </div>
                <div>
                  <OrbitCardTitle>Marketing e Vendas Atual</OrbitCardTitle>
                  <OrbitCardDescription>Como funciona hoje?</OrbitCardDescription>
                </div>
              </div>
            </OrbitCardHeader>
            <OrbitCardContent className="space-y-4">
              <div className="space-y-3">
                <Label>Já investe em marketing digital? *</Label>
                <RadioGroup
                  value={formData.investe_marketing}
                  onValueChange={(value: 'sim' | 'nao') => setFormData({ ...formData, investe_marketing: value })}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="sim" id="investe-sim" />
                    <Label htmlFor="investe-sim" className="font-normal cursor-pointer">
                      Sim
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="nao" id="investe-nao" />
                    <Label htmlFor="investe-nao" className="font-normal cursor-pointer">
                      Não
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {formData.investe_marketing === 'sim' && (
                <div className="space-y-2 animate-in fade-in duration-300">
                  <Label htmlFor="resultados">Quais resultados tem obtido?</Label>
                  <Textarea
                    id="resultados"
                    placeholder="Conte-nos sobre os resultados atuais, o que funciona e o que não funciona..."
                    rows={4}
                    value={formData.resultados || ''}
                    onChange={(e) => setFormData({ ...formData, resultados: e.target.value })}
                  />
                </div>
              )}
            </OrbitCardContent>
          </OrbitCard>

          {/* Objetivos */}
          <OrbitCard gradient="from-green-500/10 via-transparent to-transparent">
            <OrbitCardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/10 rounded-lg">
                  <Target className="h-5 w-5 text-green-400" />
                </div>
                <div>
                  <OrbitCardTitle>Objetivos e Metas</OrbitCardTitle>
                  <OrbitCardDescription>O que você deseja alcançar?</OrbitCardDescription>
                </div>
              </div>
            </OrbitCardHeader>
            <OrbitCardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="objetivo">Principal Objetivo</Label>
                <Textarea
                  id="objetivo"
                  placeholder="Ex: Aumentar vendas em 30%, gerar 100 leads qualificados por mês, melhorar presença digital..."
                  rows={4}
                  value={formData.objetivo || ''}
                  onChange={(e) => setFormData({ ...formData, objetivo: e.target.value })}
                />
              </div>
            </OrbitCardContent>
          </OrbitCard>

          {/* Financeiro */}
          <OrbitCard gradient="from-yellow-500/10 via-transparent to-transparent">
            <OrbitCardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-500/10 rounded-lg">
                  <DollarSign className="h-5 w-5 text-yellow-400" />
                </div>
                <div>
                  <OrbitCardTitle>Informações Financeiras</OrbitCardTitle>
                  <OrbitCardDescription>Para dimensionar a melhor solução</OrbitCardDescription>
                </div>
              </div>
            </OrbitCardHeader>
            <OrbitCardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="faturamento">Faturamento Mensal *</Label>
                  <Select
                    value={formData.faturamento}
                    onValueChange={(value) => setFormData({ ...formData, faturamento: value })}
                    required
                  >
                    <SelectTrigger id="faturamento">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ate-10k">Até R$ 10.000</SelectItem>
                      <SelectItem value="10k-50k">R$ 10.000 - R$ 50.000</SelectItem>
                      <SelectItem value="50k-100k">R$ 50.000 - R$ 100.000</SelectItem>
                      <SelectItem value="100k-500k">R$ 100.000 - R$ 500.000</SelectItem>
                      <SelectItem value="mais-500k">Acima de R$ 500.000</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="budget">Budget para Marketing *</Label>
                  <Select
                    value={formData.budget}
                    onValueChange={(value) => setFormData({ ...formData, budget: value })}
                    required
                  >
                    <SelectTrigger id="budget">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ate-1k">Até R$ 1.000</SelectItem>
                      <SelectItem value="1k-3k">R$ 1.000 - R$ 3.000</SelectItem>
                      <SelectItem value="3k-5k">R$ 3.000 - R$ 5.000</SelectItem>
                      <SelectItem value="5k-10k">R$ 5.000 - R$ 10.000</SelectItem>
                      <SelectItem value="mais-10k">Acima de R$ 10.000</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </OrbitCardContent>
          </OrbitCard>

          {/* Submit Button */}
          <div className="flex justify-center pt-6">
            <Button
              type="submit"
              size="lg"
              disabled={loading}
              className="w-full md:w-auto min-w-[300px] h-14 text-lg font-semibold"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-5 w-5" />
                  Enviar Briefing
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
