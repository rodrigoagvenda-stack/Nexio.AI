'use client';

import { useState } from 'react';
import { useUser } from '@/lib/hooks/useUser';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Link2, Zap, FileText, Users, Loader2, MapPin } from 'lucide-react';

const LEAD_LIMITS = [10, 25, 50, 100, 200, 500];

const ESTADOS_BRASIL = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

const NICHOS = [
  'Restaurantes',
  'Academias',
  'Salões de Beleza',
  'Clínicas Médicas',
  'Consultórios Odontológicos',
  'Escritórios de Advocacia',
  'Imobiliárias',
  'Agências de Marketing',
  'Lojas de Roupas',
  'Pet Shops',
  'Oficinas Mecânicas',
  'Escolas',
  'Hotéis e Pousadas',
  'Bares e Cafeterias',
  'Farmácias',
  'Supermercados',
  'Padarias',
  'Floriculturas',
  'Auto Escolas',
  'Outros',
];

export default function ProspectAIPage() {
  const { company } = useUser();
  const [activeTab, setActiveTab] = useState<'url' | 'manual'>('manual');

  // URL Mode
  const [mapsUrl, setMapsUrl] = useState('');
  const [leadLimit, setLeadLimit] = useState(100);

  // Manual Mode
  const [cidade, setCidade] = useState('');
  const [estado, setEstado] = useState('');
  const [nicho, setNicho] = useState('');
  const [customNicho, setCustomNicho] = useState('');

  const [extracting, setExtracting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentAction, setCurrentAction] = useState('');

  const validateUrl = (url: string): boolean => {
    const googleMapsPattern = /^https?:\/\/(www\.)?google\.com(\.br)?\/maps\//i;
    return googleMapsPattern.test(url);
  };

  const validateManualForm = (): boolean => {
    if (!cidade.trim()) {
      toast.error('Por favor, informe a cidade');
      return false;
    }
    if (!estado) {
      toast.error('Por favor, selecione o estado');
      return false;
    }
    if (!nicho && !customNicho.trim()) {
      toast.error('Por favor, selecione ou digite um nicho');
      return false;
    }
    return true;
  };

  const handleExtract = async () => {
    if (!company?.id) {
      toast.error('Erro ao identificar sua empresa');
      return;
    }

    try {
      setExtracting(true);
      setProgress(0);
      setCurrentAction('Validando informações...');

      let finalUrl = '';

      if (activeTab === 'url') {
        if (!mapsUrl.trim()) {
          toast.error('Por favor, cole a URL do Google Maps');
          return;
        }

        if (!validateUrl(mapsUrl)) {
          toast.error('URL inválida. Use uma URL do Google Maps (.com ou .com.br)');
          return;
        }

        finalUrl = mapsUrl;
      } else {
        if (!validateManualForm()) {
          return;
        }

        setCurrentAction('Montando URL de busca...');
        setProgress(10);

        const nichoFinal = nicho === 'Outros' ? customNicho : nicho;
        const query = `${nichoFinal} em ${cidade}, ${estado}`;
        const encodedQuery = encodeURIComponent(query);
        finalUrl = `https://www.google.com.br/maps/search/${encodedQuery}`;

        toast.info(`Buscando: ${query}`);
      }

      setProgress(20);
      setCurrentAction('Conectando ao Google Maps...');

      await new Promise(resolve => setTimeout(resolve, 500));

      const response = await fetch('/api/extraction/prospect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: finalUrl,
          limit: leadLimit,
          companyId: company.id,
          cidade,
          estado,
          nicho: nicho === 'Outros' ? customNicho : nicho,
        }),
      });

      setProgress(40);
      setCurrentAction('Extraindo dados...');

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Erro ao extrair leads');
      }

      setProgress(60);
      setCurrentAction('Processando informações...');

      await new Promise(resolve => setTimeout(resolve, 1000));
      setProgress(80);
      setCurrentAction('Qualificando leads...');

      await new Promise(resolve => setTimeout(resolve, 1000));
      setProgress(100);
      setCurrentAction('Concluído!');

      toast.success(`${data.extractedCount} leads extraídos com sucesso!`);

      // Reset
      setMapsUrl('');
      setCidade('');
      setEstado('');
      setNicho('');
      setCustomNicho('');

    } catch (error: any) {
      console.error('Extraction error:', error);
      toast.error(error.message || 'Erro ao extrair leads. Tente novamente.');
    } finally {
      setExtracting(false);
      setProgress(0);
      setCurrentAction('');
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 md:p-8 pt-20">
      <div className="w-full max-w-4xl space-y-8 md:space-y-12">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold leading-tight tracking-tight">
            A maior <span className="text-primary">engine de prospecção B2B</span> já construída.
          </h1>
          <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto">
            Transforme qualquer busca do Google Maps em leads qualificados.
          </p>
        </div>

        {/* Main Card */}
        <Card className="p-4 md:p-8 space-y-4 md:space-y-6 bg-card border-border">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'url' | 'manual')}>
            <TabsList className="grid w-full grid-cols-2 mb-4 md:mb-6">
              <TabsTrigger value="manual" className="text-xs md:text-sm">
                <MapPin className="h-3 w-3 md:h-4 md:w-4 mr-2" />
                Buscar por Cidade
              </TabsTrigger>
              <TabsTrigger value="url" className="text-xs md:text-sm">
                <Link2 className="h-3 w-3 md:h-4 md:w-4 mr-2" />
                Cole a URL do Maps
              </TabsTrigger>
            </TabsList>

            {/* Manual Mode */}
            <TabsContent value="manual" className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Cidade</label>
                  <Input
                    placeholder="Ex: São Paulo"
                    value={cidade}
                    onChange={(e) => setCidade(e.target.value)}
                    disabled={extracting}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Estado</label>
                  <Select value={estado} onValueChange={setEstado} disabled={extracting}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o estado" />
                    </SelectTrigger>
                    <SelectContent>
                      {ESTADOS_BRASIL.map((uf) => (
                        <SelectItem key={uf} value={uf}>
                          {uf}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Nicho / Segmento</label>
                <Select value={nicho} onValueChange={setNicho} disabled={extracting}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o nicho" />
                  </SelectTrigger>
                  <SelectContent>
                    {NICHOS.map((n) => (
                      <SelectItem key={n} value={n}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {nicho === 'Outros' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Digite o nicho</label>
                  <Input
                    placeholder="Ex: Lojas de Produtos Naturais"
                    value={customNicho}
                    onChange={(e) => setCustomNicho(e.target.value)}
                    disabled={extracting}
                  />
                </div>
              )}
            </TabsContent>

            {/* URL Mode */}
            <TabsContent value="url" className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Link2 className="h-4 w-4" />
                  URL do Google Maps
                </label>
                <Input
                  placeholder="https://www.google.com/maps/search/..."
                  value={mapsUrl}
                  onChange={(e) => setMapsUrl(e.target.value)}
                  disabled={extracting}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Aceita URLs do Google Maps (.com ou .com.br)
                </p>
              </div>
            </TabsContent>
          </Tabs>

          {/* Lead Limit */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
            <Select
              value={leadLimit.toString()}
              onValueChange={(v) => setLeadLimit(parseInt(v))}
              disabled={extracting}
            >
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEAD_LIMITS.map((limit) => (
                  <SelectItem key={limit} value={limit.toString()}>
                    {limit} leads
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">leads para extrair</span>
          </div>

          {/* Extract Button */}
          <Button
            onClick={handleExtract}
            disabled={extracting}
            size="lg"
            className="w-full text-base md:text-lg h-12 md:h-14"
          >
            {extracting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 md:h-5 md:w-5 animate-spin" />
                {currentAction}
              </>
            ) : (
              'Extrair leads'
            )}
          </Button>

          {/* Progress */}
          {extracting && (
            <div className="space-y-2">
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div
                  className="bg-primary h-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-sm text-center text-muted-foreground">{progress}%</p>
            </div>
          )}
        </Card>

        {/* Benefits */}
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
          <Card className="p-4 md:p-6 space-y-3 bg-card/50 border-border/50">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Zap className="h-5 w-5 md:h-6 md:w-6 text-primary" />
            </div>
            <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
              Extrai dados de Google Maps automaticamente com IA em segundos.
            </p>
          </Card>

          <Card className="p-4 md:p-6 space-y-3 bg-card/50 border-border/50">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="h-5 w-5 md:h-6 md:w-6 text-primary" />
            </div>
            <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
              Captura nome, telefone, email, endereço e redes sociais em um clique.
            </p>
          </Card>

          <Card className="p-4 md:p-6 space-y-3 bg-card/50 border-border/50 sm:col-span-2 md:col-span-1">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="h-5 w-5 md:h-6 md:w-6 text-primary" />
            </div>
            <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
              Leads organizados e qualificados direto no seu pipeline de vendas.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
