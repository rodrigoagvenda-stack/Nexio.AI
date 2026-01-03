'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Image, Video, File, Music, Loader2, Download, X } from 'lucide-react';
import { toast } from 'sonner';

interface MediaMessage {
  id: number;
  texto_da_mensagem: string;
  tipo_de_mensagem: string;
  url_da_midia: string;
  carimbo_de_data_e_hora: string;
}

interface MidiaTabProps {
  chatId: number;
  companyId: number;
}

export function MidiaTab({ chatId, companyId }: MidiaTabProps) {
  const [mediaMessages, setMediaMessages] = useState<MediaMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  useEffect(() => {
    fetchMedia();
  }, [chatId, filter]);

  async function fetchMedia() {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        companyId: companyId.toString(),
      });

      if (filter !== 'all') {
        params.append('type', filter);
      }

      const response = await fetch(`/api/chats/${chatId}/media?${params}`);
      const data = await response.json();

      if (data.success) {
        setMediaMessages(data.data);
      }
    } catch (error) {
      console.error('Error fetching media:', error);
      toast.error('Erro ao carregar mídia');
    } finally {
      setLoading(false);
    }
  }

  function getMediaIcon(type: string) {
    switch (type) {
      case 'image':
        return <Image className="h-4 w-4" />;
      case 'video':
        return <Video className="h-4 w-4" />;
      case 'audio':
        return <Music className="h-4 w-4" />;
      case 'document':
        return <File className="h-4 w-4" />;
      default:
        return <File className="h-4 w-4" />;
    }
  }

  function renderMediaThumbnail(msg: MediaMessage) {
    switch (msg.tipo_de_mensagem) {
      case 'image':
        return (
          <div
            className="aspect-square rounded overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => setLightboxUrl(msg.url_da_midia)}
          >
            <img
              src={msg.url_da_midia}
              alt="Imagem"
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
        );

      case 'video':
        return (
          <div className="aspect-square rounded overflow-hidden bg-black">
            <video
              src={msg.url_da_midia}
              className="w-full h-full object-cover"
              preload="metadata"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <Video className="h-8 w-8 text-white" />
            </div>
          </div>
        );

      case 'audio':
        return (
          <div className="aspect-square rounded bg-muted flex flex-col items-center justify-center gap-2 p-2">
            <Music className="h-8 w-8 text-muted-foreground" />
            <p className="text-xs text-center text-muted-foreground">
              {new Date(msg.carimbo_de_data_e_hora).toLocaleDateString()}
            </p>
          </div>
        );

      case 'document':
        const fileName = msg.url_da_midia.split('/').pop() || 'documento';
        return (
          <div className="aspect-square rounded bg-muted flex flex-col items-center justify-center gap-2 p-2">
            <File className="h-8 w-8 text-muted-foreground" />
            <p className="text-xs text-center text-muted-foreground truncate w-full">
              {fileName}
            </p>
          </div>
        );

      default:
        return null;
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {/* Filtros */}
        <Tabs value={filter} onValueChange={setFilter} className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="all" className="text-xs">Todas</TabsTrigger>
            <TabsTrigger value="image" className="text-xs">
              <Image className="h-3 w-3" />
            </TabsTrigger>
            <TabsTrigger value="video" className="text-xs">
              <Video className="h-3 w-3" />
            </TabsTrigger>
            <TabsTrigger value="audio" className="text-xs">
              <Music className="h-3 w-3" />
            </TabsTrigger>
            <TabsTrigger value="document" className="text-xs">
              <File className="h-3 w-3" />
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Contador */}
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">
            {mediaMessages.length} {mediaMessages.length === 1 ? 'arquivo' : 'arquivos'}
          </p>
          {mediaMessages.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => toast.info('Download em lote em breve')}
            >
              <Download className="h-4 w-4 mr-1" />
              Baixar Todas
            </Button>
          )}
        </div>

        {/* Grid de mídia */}
        {mediaMessages.length === 0 ? (
          <div className="text-center py-8">
            {getMediaIcon(filter)}
            <p className="text-sm text-muted-foreground mt-2">
              Nenhuma mídia encontrada
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {mediaMessages.map((msg) => (
              <div key={msg.id} className="relative group">
                {renderMediaThumbnail(msg)}
                {/* Overlay com ações */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded flex items-center justify-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.open(msg.url_da_midia, '_blank')}
                    className="text-white hover:text-white hover:bg-white/20"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 text-white hover:bg-white/20"
            onClick={() => setLightboxUrl(null)}
          >
            <X className="h-6 w-6" />
          </Button>
          <img
            src={lightboxUrl}
            alt="Preview"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
