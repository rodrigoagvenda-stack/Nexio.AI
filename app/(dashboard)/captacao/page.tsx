'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MapPin, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useUser } from '@/lib/hooks/useUser';
import CountUp from 'react-countup';

export default function CaptacaoPage() {
  const { company } = useUser();
  const [mapsUrl, setMapsUrl] = useState('');
  const [quantity, setQuantity] = useState('100');
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [extractedCount, setExtractedCount] = useState(0);
  const [currentCount, setCurrentCount] = useState(0);
  const [success, setSuccess] = useState(false);

  const handleExtract = async () => {
    if (!mapsUrl || !mapsUrl.includes('google.com/maps')) {
      toast.error('Por favor, insira uma URL válida do Google Maps');
      return;
    }

    if (!company?.id) {
      toast.error('Erro ao identificar empresa');
      return;
    }

    setLoading(true);
    setShowModal(true);
    setSuccess(false);
    setCurrentCount(0);

    try {
      const response = await fetch('/api/extraction/maps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startUrl: mapsUrl,
          quantity: parseInt(quantity),
          companyId: company.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Erro ao extrair leads');
      }

      // Simular progresso
      const targetCount = data.extractedCount || parseInt(quantity);
      const interval = setInterval(() => {
        setCurrentCount((prev) => {
          if (prev >= targetCount) {
            clearInterval(interval);
            setSuccess(true);
            setLoading(false);
            return targetCount;
          }
          return prev + Math.floor(Math.random() * 10) + 1;
        });
      }, 100);

      setExtractedCount(targetCount);
      toast.success('Leads extraídos com sucesso!');
    } catch (error: any) {
      console.error('Extraction error:', error);
      toast.error(error.message);
      setShowModal(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-4 sm:p-6 md:p-8 border border-primary/20">
        <div className="absolute top-0 right-0 w-32 h-32 sm:w-48 sm:h-48 md:w-64 md:h-64 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-24 h-24 sm:w-36 sm:h-36 md:w-48 md:h-48 bg-primary/5 rounded-full blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-2 sm:gap-3 mb-2">
            <div className="p-2 sm:p-3 bg-primary/10 rounded-xl">
              <MapPin className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 text-primary" />
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              prospect.AI
            </h1>
          </div>
          <p className="text-sm sm:text-base md:text-lg text-muted-foreground max-w-2xl">
            Extraia leads qualificados do Google Maps automaticamente com inteligência artificial
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="border-2 shadow-lg hover:shadow-xl transition-all duration-300">
          <CardHeader className="space-y-3">
            <CardTitle className="flex items-center gap-2 text-xl">
              <div className="p-2 bg-primary/10 rounded-lg">
                <MapPin className="h-5 w-5 text-primary" />
              </div>
              Extração Google Maps
            </CardTitle>
            <CardDescription className="text-base">
              Cole a URL de uma busca do Google Maps e extraia contatos automaticamente
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="maps-url">URL do Google Maps *</Label>
              <Input
                id="maps-url"
                type="url"
                placeholder="https://www.google.com/maps/search/..."
                value={mapsUrl}
                onChange={(e) => setMapsUrl(e.target.value)}
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
                Cole o link completo de uma busca no Google Maps
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantity">Quantidade de Leads</Label>
              <Select value={quantity} onValueChange={setQuantity} disabled={loading}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="50">50 leads</SelectItem>
                  <SelectItem value="100">100 leads</SelectItem>
                  <SelectItem value="150">150 leads</SelectItem>
                  <SelectItem value="200">200 leads</SelectItem>
                  <SelectItem value="250">250 leads</SelectItem>
                  <SelectItem value="300">300 leads</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleExtract}
              disabled={loading || !mapsUrl}
              className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg hover:shadow-xl transition-all duration-300 text-base font-bold"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Extraindo...
                </>
              ) : (
                <>
                  <MapPin className="mr-2 h-5 w-5" />
                  Extrair Leads
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-2 shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl">Como funciona?</CardTitle>
            <CardDescription>Siga estes passos simples para extrair leads</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-5">
              <div className="flex gap-4 group">
                <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/60 text-primary-foreground flex items-center justify-center font-black text-lg shadow-lg group-hover:scale-110 transition-transform">
                  1
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-base mb-1">Faça uma busca no Google Maps</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Busque por &quot;restaurantes em São Paulo&quot;, &quot;academias em Campinas&quot;, etc.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 group">
                <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/60 text-primary-foreground flex items-center justify-center font-black text-lg shadow-lg group-hover:scale-110 transition-transform">
                  2
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-base mb-1">Copie a URL completa</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Cole aqui a URL da página de resultados do Google Maps
                  </p>
                </div>
              </div>

              <div className="flex gap-4 group">
                <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/60 text-primary-foreground flex items-center justify-center font-black text-lg shadow-lg group-hover:scale-110 transition-transform">
                  3
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-base mb-1">Escolha a quantidade</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Selecione quantos leads você quer extrair (50 a 300)
                  </p>
                </div>
              </div>

              <div className="flex gap-4 group">
                <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/60 text-primary-foreground flex items-center justify-center font-black text-lg shadow-lg group-hover:scale-110 transition-transform">
                  4
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-base mb-1">Aguarde a extração</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Em 30-60 segundos, os leads estarão prontos no CRM
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modal de Extração */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {success ? 'Extração Concluída!' : 'Extraindo Leads...'}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            {success ? (
              <>
                <CheckCircle2 className="h-16 w-16 text-green-500 animate-pulse" />
                <div className="text-center">
                  <p className="text-6xl font-bold text-primary">
                    <CountUp end={extractedCount} duration={1} />
                  </p>
                  <p className="text-muted-foreground mt-2">leads extraídos com sucesso!</p>
                </div>
                <Button onClick={() => window.location.href = '/crm'} className="w-full">
                  Abrir CRM
                </Button>
              </>
            ) : (
              <>
                <Loader2 className="h-16 w-16 text-primary animate-spin" />
                <div className="text-center">
                  <p className="text-6xl font-bold text-primary">
                    <CountUp end={currentCount} duration={0.5} />
                  </p>
                  <p className="text-muted-foreground mt-2">de {quantity} leads</p>
                </div>
                <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-primary h-full transition-all duration-300"
                    style={{ width: `${(currentCount / parseInt(quantity)) * 100}%` }}
                  />
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
