'use client';

import { FileText, Image, Mic, DollarSign } from 'lucide-react';

interface AttachmentOptionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchorRect?: DOMRect | null;
  onSelectDocument: () => void;
  onSelectImage: () => void;
  onSelectAudio: () => void;
  onSelectCharge?: () => void;
  hasLead?: boolean;
}

export function AttachmentOptionsDialog({
  open,
  onOpenChange,
  anchorRect,
  onSelectDocument,
  onSelectImage,
  onSelectAudio,
  onSelectCharge,
  hasLead,
}: AttachmentOptionsDialogProps) {
  if (!open) return null;

  const close = () => onOpenChange(false);

  const options = [
    { id: 'document', label: 'Documento', icon: <FileText className="h-5 w-5 text-green-500" />, onClick: () => { onSelectDocument(); close(); } },
    { id: 'photos-videos', label: 'Fotos e vídeos', icon: <Image className="h-5 w-5 text-pink-500" />, onClick: () => { onSelectImage(); close(); } },
    { id: 'audio', label: 'Áudio', icon: <Mic className="h-5 w-5 text-green-500" />, onClick: () => { onSelectAudio(); close(); } },
    ...(hasLead && onSelectCharge ? [{ id: 'charge', label: 'Gerar cobrança', icon: <DollarSign className="h-5 w-5 text-amber-500" />, onClick: () => { onSelectCharge(); close(); } }] : []),
  ];

  // Posiciona acima do botão grampo usando anchorRect
  const menuStyle: React.CSSProperties = anchorRect
    ? {
        position: 'fixed',
        bottom: window.innerHeight - anchorRect.top + 8,
        left: anchorRect.left,
        zIndex: 50,
        minWidth: '200px',
        maxWidth: '260px',
      }
    : {
        position: 'fixed',
        bottom: 80,
        left: 16,
        zIndex: 50,
        minWidth: '200px',
        maxWidth: '260px',
      };

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={close} />
      <div
        style={menuStyle}
        className="bg-background/95 backdrop-blur-sm shadow-2xl rounded-2xl border border-border/50 animate-in slide-in-from-bottom-2 fade-in duration-150"
      >
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
