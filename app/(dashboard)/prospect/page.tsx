'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/lib/hooks/useUser';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import TextType from '@/components/TextType';
import { AnimatedShinyText } from '@/components/ui/animated-shiny-text';
import Orb from '@/components/Orb';
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
import { toast } from '@/components/ui/use-toast';
import { Link2, Zap, Loader2, MapPin, Lock, Sparkles } from 'lucide-react';

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
  const { company, loading: userLoading } = useUser();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'url' | 'manual'>('manual');

  const hasOrbitAccess = company?.plan_type === 'performance' || company?.plan_type === 'advanced'
    || company?.plan_name === 'NEXIO GROWTH' || company?.plan_name === 'NEXIO ADS'
    || company?.plan_name === 'ZAAPLI GROWTH' || company?.plan_name === 'ZAAPLI PRO';

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
  const [liveInserted, setLiveInserted] = useState(0);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Acumulador de sessão
  const [session, setSession] = useState<{ runs: number; inserted: number; processed: number } | null>(null);

  // Mensagens dinâmicas rotativas durante extração
  const PROGRESS_MESSAGES = [
    'Conectando ao Google Maps...',
    'Coletando empresas do Apify...',
    'Validando números de WhatsApp...',
    'Gerando Score de qualificação...',
    'Gerando MQL dos leads...',
    'Filtrando leads com WhatsApp...',
    'Inserindo leads no CRM...',
    'Quase lá...',
  ];
  const msgIndexRef = useRef(0);

  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  useEffect(() => {
    return () => stopPolling();
  }, []);

  const validateUrl = (url: string): boolean => {
    const googleMapsPattern = /^https?:\/\/(www\.)?google\.com(\.br)?\/maps\//i;
    return googleMapsPattern.test(url);
  };

  const validateManualForm = (): boolean => {
    if (!cidade.trim()) {
      toast({
        variant: "destructive",
        description: "Por favor, informe a cidade",
      });
      return false;
    }
    if (!estado) {
      toast({
        variant: "destructive",
        description: "Por favor, selecione o estado",
      });
      return false;
    }
    if (!nicho && !customNicho.trim()) {
      toast({
        variant: "destructive",
        description: "Por favor, selecione ou digite um nicho",
      });
      return false;
    }
    return true;
  };

  const handleExtract = async () => {
    if (!company?.id) {
      toast({ variant: "destructive", description: "Erro ao identificar sua empresa" });
      return;
    }

    let finalUrl = '';
    if (activeTab === 'url') {
      if (!mapsUrl.trim() || !validateUrl(mapsUrl)) {
        toast({ variant: "destructive", description: "URL inválida. Use uma URL do Google Maps (.com ou .com.br)" });
        return;
      }
      finalUrl = mapsUrl;
    } else {
      if (!validateManualForm()) return;
      const nichoFinal = nicho === 'Outros' ? customNicho : nicho;
      finalUrl = `https://www.google.com.br/maps/search/${encodeURIComponent(`${nichoFinal} em ${cidade}, ${estado}`)}`;
    }

    let safetyTimeout: ReturnType<typeof setTimeout> | null = null;

    try {
      setExtracting(true);
      setLiveInserted(0);
      setProgress(5);
      msgIndexRef.current = 0;
      setCurrentAction(PROGRESS_MESSAGES[0]);

      // Rotacionar mensagens a cada 4s
      const msgInterval = setInterval(() => {
        msgIndexRef.current = (msgIndexRef.current + 1) % PROGRESS_MESSAGES.length;
        setCurrentAction(PROGRESS_MESSAGES[msgIndexRef.current]);
      }, 4000);

      // Disparar extração — recebe sessionId imediatamente
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

      const data = await response.json();
      clearInterval(msgInterval);

      if (!response.ok) throw new Error(data.message || 'Erro ao extrair leads');

      const { sessionId, requested } = data;
      setProgress(15);

      // Timeout de segurança: encerra após 5 minutos mesmo sem Complete
      safetyTimeout = setTimeout(() => {
        stopPolling();
        setProgress(100);
        setCurrentAction('Concluído!');
        setSession(prev => {
          const ins = prev ? prev.inserted : liveInserted;
          return prev
            ? { runs: prev.runs + 1, inserted: prev.inserted + liveInserted, processed: prev.processed + requested }
            : { runs: 1, inserted: liveInserted, processed: requested };
        });
        toast({ variant: 'default', title: 'Extração concluída!', description: `${liveInserted} de ${requested} leads com WhatsApp inseridos.` });
        setTimeout(() => { setExtracting(false); setProgress(0); setCurrentAction(''); }, 1500);
      }, 5 * 60 * 1000);

      // Polling direto no Supabase a cada 3s — sem passar pela API
      const supabase = createClient();
      pollingRef.current = setInterval(async () => {
        const { data: sessionRow, error } = await supabase
          .from('extraction_sessions')
          .select('inserted, status, requested')
          .eq('id', sessionId)
          .single();

        if (error || !sessionRow) return;

        const { inserted, status } = sessionRow;
        setLiveInserted(inserted);

        const pct = Math.min(15 + Math.round((inserted / requested) * 80), 95);
        setProgress(pct);

        const idx = Math.min(Math.floor((inserted / requested) * PROGRESS_MESSAGES.length), PROGRESS_MESSAGES.length - 1);
        setCurrentAction(PROGRESS_MESSAGES[idx]);

        if (status === 'complete') {
          stopPolling();
          if (safetyTimeout) clearTimeout(safetyTimeout);
          setProgress(100);
          setCurrentAction('Concluído!');

          setSession(prev => prev
            ? { runs: prev.runs + 1, inserted: prev.inserted + inserted, processed: prev.processed + requested }
            : { runs: 1, inserted, processed: requested }
          );

          toast({
            variant: "default",
            title: "Extração concluída!",
            description: `${inserted} de ${requested} leads tinham WhatsApp e foram inseridos.`,
          });

          setMapsUrl(''); setCidade(''); setEstado(''); setNicho(''); setCustomNicho('');
          setTimeout(() => { setExtracting(false); setProgress(0); setCurrentAction(''); }, 1500);
        }
      }, 3000);

    } catch (error: any) {
      stopPolling();
      if (safetyTimeout) clearTimeout(safetyTimeout);
      console.error('Extraction error:', error);
      toast({ variant: "destructive", description: error.message || "Erro ao extrair leads. Tente novamente." });
      setExtracting(false);
      setProgress(0);
      setCurrentAction('');
    }
  };

  // Aguardar dados do usuário antes de decidir o que mostrar
  if (userLoading) {
    return (
      <div className="h-[calc(100vh-64px)] -m-3 md:-m-6 bg-background relative overflow-hidden flex items-center justify-center">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[700px] h-[700px]">
            <Orb hue={270} backgroundColor="hsl(var(--background))" />
          </div>
        </div>
        <Loader2 className="h-8 w-8 animate-spin text-primary/50 relative" />
      </div>
    );
  }

  // Se não tem acesso ao Orbit, mostrar mensagem de upgrade
  if (!hasOrbitAccess) {
    return (
      <div className="h-[calc(100vh-64px)] -m-3 md:-m-6 bg-background relative overflow-hidden flex items-center justify-center">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[700px] h-[700px]">
            <Orb hue={270} backgroundColor="hsl(var(--background))" />
          </div>
        </div>

        <div className="relative max-w-2xl mx-auto px-6">
          <div className="space-y-8 text-center">
            <div className="space-y-6">
              <div className="min-h-[60px] md:min-h-[80px] lg:min-h-[100px] flex items-center justify-center w-full">
                <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-light tracking-tight">
                  Prospecção inteligente.
                </h1>
              </div>
            </div>

            <Card className="relative p-8 border border-border/40 bg-card/60 backdrop-blur-lg rounded-2xl shadow-2xl">
              <div className="flex flex-col items-center space-y-6">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-green-400 via-emerald-500 to-green-600 rounded-full blur-xl opacity-30"></div>
                  <div className="relative bg-gradient-to-r from-green-400 via-emerald-500 to-green-600 p-4 rounded-full">
                    <Lock className="h-10 w-10 text-white" />
                  </div>
                </div>

                <div className="space-y-3 max-w-md">
                  <h2 className="text-xl font-semibold bg-gradient-to-r from-green-400 via-emerald-500 to-green-600 bg-clip-text text-transparent">
                    Orbit não disponível no seu plano
                  </h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    O recurso de prospecção inteligente com Orbit está disponível apenas nos planos <span className="font-semibold text-green-400">ZAAPLI GROWTH</span> e <span className="font-semibold text-emerald-400">ZAAPLI PRO</span>.
                  </p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Você está no plano <span className="font-semibold">{company?.plan_name || 'ZAAPLI START'}</span>.
                  </p>
                </div>

                <div className="pt-2">
                  <Button
                    onClick={() => window.location.href = '/admin/empresas/' + company?.id}
                    className="group bg-gradient-to-r from-green-400 via-emerald-500 to-green-600 hover:from-green-500 hover:via-pink-600 hover:to-green-700 shadow-lg shadow-green-500/30 rounded-xl"
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    Fazer upgrade do plano
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-64px)] -m-3 md:-m-6 bg-background relative overflow-hidden flex items-center justify-center">
      {/* Orb background com efeito React Bits */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[700px] h-[700px]">
          <Orb hue={270} backgroundColor="hsl(var(--background))" />
        </div>
      </div>

      <div className="relative max-w-2xl mx-auto px-6">
        <div className="space-y-8 text-center">
          {/* Hero */}
          <div className="space-y-6">
            <div className="min-h-[60px] md:min-h-[80px] lg:min-h-[100px] flex items-center justify-center w-full">
              <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-light tracking-tight whitespace-nowrap">
                <TextType
                  text={[
                    'Prospecção inteligente.',
                    'Leads qualificados.',
                    'Vendas automatizadas.',
                  ]}
                  as="span"
                  className="font-light inline-block whitespace-nowrap"
                  typingSpeed={80}
                  deletingSpeed={40}
                  pauseDuration={2000}
                  showCursor={true}
                  cursorCharacter="|"
                  cursorClassName="text-primary"
                  variableSpeed={false}
                  onSentenceComplete={() => {}}
                />
              </h1>
            </div>
          </div>

          {/* Form */}
          <div>
            <Card className="relative p-6 border border-border/40 bg-card/60 backdrop-blur-lg rounded-2xl shadow-2xl">
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'url' | 'manual')}>
                <TabsList className="grid w-full grid-cols-2 mb-6 h-11 bg-muted/30 rounded-xl border border-border/50">
                  <TabsTrigger value="manual" className="text-xs md:text-sm data-[state=active]:bg-background/80 rounded-lg">
                    <MapPin className="h-3.5 w-3.5 mr-2" />
                    Buscar por Cidade
                  </TabsTrigger>
                  <TabsTrigger value="url" className="text-xs md:text-sm data-[state=active]:bg-background/80 rounded-lg">
                    <Link2 className="h-3.5 w-3.5 mr-2" />
                    Cole a URL do Maps
                  </TabsTrigger>
                </TabsList>

            {/* Manual Mode */}
            <TabsContent value="manual" className="space-y-4 min-h-[180px] text-left">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider block text-left">Cidade</label>
                  <Input
                    placeholder="São Paulo"
                    value={cidade}
                    onChange={(e) => setCidade(e.target.value)}
                    disabled={extracting}
                    className="h-10 text-sm bg-background/50 border-border/50 focus:border-primary/50 transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider block text-left">Estado</label>
                  <Select value={estado} onValueChange={setEstado} disabled={extracting}>
                    <SelectTrigger className="h-10 text-sm bg-background/50 border-border/50 focus:border-primary/50">
                      <SelectValue placeholder="UF" />
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
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider block text-left">Segmento</label>
                <Select value={nicho} onValueChange={setNicho} disabled={extracting}>
                  <SelectTrigger className="h-10 text-sm bg-background/50 border-border/50 focus:border-primary/50">
                    <SelectValue placeholder="Selecione" />
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
                  <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider block text-left">Nicho personalizado</label>
                  <Input
                    placeholder="Digite o nicho"
                    value={customNicho}
                    onChange={(e) => setCustomNicho(e.target.value)}
                    disabled={extracting}
                    className="h-10 text-sm bg-background/50 border-border/50 focus:border-primary/50 transition-colors"
                  />
                </div>
              )}
            </TabsContent>

            {/* URL Mode */}
            <TabsContent value="url" className="space-y-4 min-h-[180px] text-left">
              <div className="space-y-2">
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 text-left">
                  <Link2 className="h-3 w-3" />
                  URL do Google Maps
                </label>
                <div className="relative">
                  <Input
                    placeholder="https://www.google.com/maps/search/..."
                    value={mapsUrl}
                    onChange={(e) => setMapsUrl(e.target.value)}
                    disabled={extracting}
                    className="h-10 font-mono text-xs bg-background/50 border-border/50 focus:border-primary/50 transition-colors pr-10"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-pulse"></div>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground/60">
                  Cole a URL da busca do Google Maps
                </p>
              </div>
            </TabsContent>
          </Tabs>

          {/* Lead Limit */}
          <div className="flex items-center gap-3 pt-1">
            <Select
              value={leadLimit.toString()}
              onValueChange={(v) => setLeadLimit(parseInt(v))}
              disabled={extracting}
            >
              <SelectTrigger className="w-32 h-10 text-sm bg-background/50 border-border/50 focus:border-primary/50">
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
            <span className="text-xs text-muted-foreground/60 font-light">leads para extrair</span>
          </div>

          {/* Extract Button */}
          <Button
            onClick={handleExtract}
            disabled={extracting}
            className="group w-full h-11 bg-gradient-to-r from-green-400 via-emerald-500 to-green-600 hover:from-green-500 hover:via-pink-600 hover:to-green-700 shadow-lg shadow-green-500/30 rounded-xl mt-5 relative overflow-hidden"
          >
            <AnimatedShinyText className="inline-flex items-center justify-center text-sm font-medium text-white dark:text-background">
              {extracting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {currentAction}
                </>
              ) : (
                <>
                  <Zap className="mr-2 h-4 w-4" />
                  Extrair leads com o orbit.ai
                </>
              )}
            </AnimatedShinyText>
          </Button>

          {/* Progress */}
          {extracting && (
            <div className="space-y-2.5 mt-5">
              <div className="w-full bg-muted/30 rounded-full h-1 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-primary to-green-500 h-full transition-all duration-700"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-muted-foreground/60 font-light">{progress}% concluído</p>
                {liveInserted > 0 && (
                  <p className="text-[10px] text-emerald-500 font-medium">{liveInserted} com WhatsApp ✓</p>
                )}
              </div>
            </div>
          )}

          {/* Resumo da sessão */}
          {session && !extracting && (
            <div className="mt-5 rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-primary uppercase tracking-wider">Resumo da sessão</p>
                <button
                  onClick={() => setSession(null)}
                  className="text-[10px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                >
                  Limpar
                </button>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-lg font-bold text-foreground">{session.processed}</p>
                  <p className="text-[10px] text-muted-foreground">Processados</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-emerald-500">{session.inserted}</p>
                  <p className="text-[10px] text-muted-foreground">Com WhatsApp</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-rose-400">{session.processed - session.inserted}</p>
                  <p className="text-[10px] text-muted-foreground">Descartados</p>
                </div>
              </div>
              {session.runs > 1 && (
                <p className="text-[10px] text-center text-muted-foreground/50">{session.runs} execuções nesta sessão</p>
              )}
            </div>
          )}
            </Card>
          </div>
        </div>
      </div>

    </div>
  );
}
