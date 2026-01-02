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
        className="fixed inset-0 bg-black/50 z-50 animate-in fade-in"
        onClick={() => onOpenChange(false)}
      />

      {/* Sheet de baixo */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-background rounded-t-2xl shadow-lg animate-in slide-in-from-bottom duration-300">
        <div className="p-4 space-y-1">
          {options.map((option) => (
            <button
              key={option.id}
              onClick={option.onClick}
              className="w-full flex items-center gap-4 p-3 hover:bg-accent rounded-lg transition-colors"
            >
              <div className={`${option.bgColor} ${option.color} p-2.5 rounded-full`}>
                {option.icon}
              </div>
              <span className="text-sm font-medium">{option.label}</span>
            </button>
          ))}
        </div>

        {/* Botão fechar */}
        <button
          onClick={() => onOpenChange(false)}
          className="w-full p-4 text-center text-sm text-muted-foreground border-t"
        >
          Cancelar
        </button>
      </div>
    </>
  );
}
