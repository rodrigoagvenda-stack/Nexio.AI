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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">prospect.AI</h1>
        <p className="text-muted-foreground mt-1">
          Extraia leads qualificados do Google Maps automaticamente
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              Extração Google Maps
            </CardTitle>
            <CardDescription>
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

            <Button onClick={handleExtract} disabled={loading || !mapsUrl} className="w-full" size="lg">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Extraindo...
                </>
              ) : (
                'Extrair Leads'
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Como funciona?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold">
                  1
                </div>
                <div>
                  <h4 className="font-medium">Faça uma busca no Google Maps</h4>
                  <p className="text-sm text-muted-foreground">
                    Busque por &quot;restaurantes em São Paulo&quot;, &quot;academias em Campinas&quot;, etc.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold">
                  2
                </div>
                <div>
                  <h4 className="font-medium">Copie a URL completa</h4>
                  <p className="text-sm text-muted-foreground">
                    Cole aqui a URL da página de resultados do Google Maps
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold">
                  3
                </div>
                <div>
                  <h4 className="font-medium">Escolha a quantidade</h4>
                  <p className="text-sm text-muted-foreground">
                    Selecione quantos leads você quer extrair (50 a 300)
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold">
                  4
                </div>
                <div>
                  <h4 className="font-medium">Aguarde a extração</h4>
                  <p className="text-sm text-muted-foreground">
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
