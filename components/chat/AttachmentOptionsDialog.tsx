'use client';

import { useState } from 'react';
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
  X,
} from 'lucide-react';

interface AttachmentOption {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  onClick: () => void;
}

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
}: AttachmentOptionsSheetProps) {
  const options: AttachmentOption[] = [
    {
      id: 'document',
      label: 'Documento',
      icon: <FileText className="h-5 w-5" />,
      color: 'text-white',
      bgColor: 'bg-purple-500',
      onClick: () => {
        onSelectDocument();
        onOpenChange(false);
      },
    },
    {
      id: 'photos-videos',
      label: 'Fotos e vídeos',
      icon: <Image className="h-5 w-5" />,
      color: 'text-white',
      bgColor: 'bg-pink-500',
      onClick: () => {
        onSelectImage();
        onOpenChange(false);
      },
    },
    {
      id: 'camera',
      label: 'Câmera',
      icon: <Camera className="h-5 w-5" />,
      color: 'text-white',
      bgColor: 'bg-red-500',
      onClick: () => {
        onSelectCamera();
        onOpenChange(false);
      },
    },
    {
      id: 'audio',
      label: 'Áudio',
      icon: <Mic className="h-5 w-5" />,
      color: 'text-white',
      bgColor: 'bg-green-500',
      onClick: () => {
        onSelectAudio();
        onOpenChange(false);
      },
    },
    {
      id: 'contact',
      label: 'Contato',
      icon: <User className="h-5 w-5" />,
      color: 'text-white',
      bgColor: 'bg-blue-500',
      onClick: () => {
        onSelectContact();
        onOpenChange(false);
      },
    },
    {
      id: 'poll',
      label: 'Enquete',
      icon: <BarChart3 className="h-5 w-5" />,
      color: 'text-white',
      bgColor: 'bg-yellow-500',
      onClick: () => {
        onSelectPoll();
        onOpenChange(false);
      },
    },
    {
      id: 'event',
      label: 'Evento',
      icon: <Calendar className="h-5 w-5" />,
      color: 'text-white',
      bgColor: 'bg-indigo-500',
      onClick: () => {
        onSelectEvent();
        onOpenChange(false);
      },
    },
    {
      id: 'sticker',
      label: 'Nova figurinha',
      icon: <Smile className="h-5 w-5" />,
      color: 'text-white',
      bgColor: 'bg-teal-500',
      onClick: () => {
        onSelectSticker();
        onOpenChange(false);
      },
    },
  ];

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50 animate-in fade-in duration-200"
        onClick={() => onOpenChange(false)}
      />

      {/* Sheet - posicionado em cima do botão de anexo */}
      <div
        className="fixed bottom-20 left-14 z-50 bg-background/95 backdrop-blur-sm shadow-2xl w-auto min-w-[200px] max-w-[280px]"
        style={{
          borderRadius: '8px',
          animation: 'slideUpFadeIn 300ms ease-out',
        }}
      >
        <style jsx>{`
          @keyframes slideUpFadeIn {
            from {
              opacity: 0;
              transform: translateY(20px) scale(0.95);
            }
            to {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }
        `}</style>
        <div className="p-2 space-y-1">
          {options.map((option) => (
            <button
              key={option.id}
              onClick={option.onClick}
              className="w-full flex items-center gap-3 p-2 hover:bg-accent/50 transition-all duration-200 rounded-lg"
            >
              <div className={`flex-shrink-0`}>
                {/* Renderizar ícone com cor direta */}
                {option.id === 'document' && <FileText className="h-5 w-5 text-purple-500" />}
                {option.id === 'photos-videos' && <Image className="h-5 w-5 text-pink-500" />}
                {option.id === 'camera' && <Camera className="h-5 w-5 text-red-500" />}
                {option.id === 'audio' && <Mic className="h-5 w-5 text-green-500" />}
                {option.id === 'contact' && <User className="h-5 w-5 text-blue-500" />}
                {option.id === 'poll' && <BarChart3 className="h-5 w-5 text-yellow-500" />}
                {option.id === 'event' && <Calendar className="h-5 w-5 text-indigo-500" />}
                {option.id === 'sticker' && <Smile className="h-5 w-5 text-teal-500" />}
              </div>
              <span className="text-sm font-medium whitespace-nowrap">{option.label}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
