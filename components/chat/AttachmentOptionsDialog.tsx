'use client';

import {
  FileText,
  Image,
  Video,
  Camera,
  Mic,
  User,
  BarChart3,
  Calendar,
  Smile,
  DollarSign,
} from 'lucide-react';

interface AttachmentOptionsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectDocument: () => void;
  onSelectImage: () => void;
  onSelectVideo: () => void;
  onSelectCamera: () => void;
  onSelectAudio: () => void;
  onSelectContact: () => void;
  onSelectPoll: () => void;
  onSelectEvent: () => void;
  onSelectSticker: () => void;
  onSelectCharge?: () => void;
  hasLead?: boolean;
}

export function AttachmentOptionsDialog({
  open,
  onOpenChange,
  onSelectDocument,
  onSelectImage,
  onSelectVideo,
  onSelectCamera,
  onSelectAudio,
  onSelectContact,
  onSelectPoll,
  onSelectEvent,
  onSelectSticker,
  onSelectCharge,
  hasLead,
}: AttachmentOptionsSheetProps) {
  if (!open) return null;

  const close = () => onOpenChange(false);

  const options = [
    { id: 'document', label: 'Documento', icon: <FileText className="h-5 w-5 text-green-500" />, onClick: () => { onSelectDocument(); close(); } },
    { id: 'photos-videos', label: 'Fotos e vídeos', icon: <Image className="h-5 w-5 text-pink-500" />, onClick: () => { onSelectImage(); close(); } },
    { id: 'camera', label: 'Câmera', icon: <Camera className="h-5 w-5 text-red-500" />, onClick: () => { onSelectCamera(); close(); } },
    { id: 'audio', label: 'Áudio', icon: <Mic className="h-5 w-5 text-green-500" />, onClick: () => { onSelectAudio(); close(); } },
    { id: 'contact', label: 'Contato', icon: <User className="h-5 w-5 text-blue-500" />, onClick: () => { onSelectContact(); close(); } },
    { id: 'poll', label: 'Enquete', icon: <BarChart3 className="h-5 w-5 text-green-500" />, onClick: () => { onSelectPoll(); close(); } },
    { id: 'event', label: 'Evento', icon: <Calendar className="h-5 w-5 text-indigo-500" />, onClick: () => { onSelectEvent(); close(); } },
    { id: 'sticker', label: 'Nova figurinha', icon: <Smile className="h-5 w-5 text-teal-500" />, onClick: () => { onSelectSticker(); close(); } },
    ...(hasLead && onSelectCharge ? [{ id: 'charge', label: 'Gerar cobrança', icon: <DollarSign className="h-5 w-5 text-amber-500" />, onClick: () => { onSelectCharge(); close(); } }] : []),
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50 animate-in fade-in duration-200"
        onClick={close}
      />

      {/* Menu: mobile: acima do botão grampo, desktop: posição fixa próxima ao botão */}
      <div
        className="fixed z-50 bg-background/95 backdrop-blur-sm shadow-2xl rounded-2xl border border-border/50"
        style={{
          /* navbar (88px) + chat toolbar (56px) + gap (8px) */
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 160px)',
          left: '16px',
          minWidth: '200px',
          maxWidth: '260px',
          animation: 'slideUpFadeIn 200ms ease-out',
        }}
      >
        <style jsx>{`
          @keyframes slideUpFadeIn {
            from { opacity: 0; transform: translateY(12px) scale(0.96); }
            to   { opacity: 1; transform: translateY(0)   scale(1);    }
          }
          @media (min-width: 640px) {
            .attachment-menu {
              left: auto;
              bottom: 80px;
            }
          }
        `}</style>
        <div className="p-2 space-y-0.5">
          {options.map((option) => (
            <button
              key={option.id}
              onClick={option.onClick}
              className="w-full flex items-center gap-3 p-2.5 hover:bg-accent/60 transition-colors rounded-xl"
            >
              <div className="flex-shrink-0">{option.icon}</div>
              <span className="text-sm font-medium whitespace-nowrap">{option.label}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
