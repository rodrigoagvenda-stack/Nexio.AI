'use client';

import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
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
} from 'lucide-react';

interface AttachmentOption {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  onClick: () => void;
}

interface AttachmentOptionsDialogProps {
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
}: AttachmentOptionsDialogProps) {
  const options: AttachmentOption[] = [
    {
      id: 'document',
      label: 'Documento',
      icon: <FileText className="h-6 w-6" />,
      color: 'bg-purple-500 hover:bg-purple-600',
      onClick: () => {
        onSelectDocument();
        onOpenChange(false);
      },
    },
    {
      id: 'photos-videos',
      label: 'Fotos e vídeos',
      icon: <Image className="h-6 w-6" />,
      color: 'bg-pink-500 hover:bg-pink-600',
      onClick: () => {
        onSelectImage();
        onOpenChange(false);
      },
    },
    {
      id: 'camera',
      label: 'Câmera',
      icon: <Camera className="h-6 w-6" />,
      color: 'bg-red-500 hover:bg-red-600',
      onClick: () => {
        onSelectCamera();
        onOpenChange(false);
      },
    },
    {
      id: 'audio',
      label: 'Áudio',
      icon: <Mic className="h-6 w-6" />,
      color: 'bg-green-500 hover:bg-green-600',
      onClick: () => {
        onSelectAudio();
        onOpenChange(false);
      },
    },
    {
      id: 'contact',
      label: 'Contato',
      icon: <User className="h-6 w-6" />,
      color: 'bg-blue-500 hover:bg-blue-600',
      onClick: () => {
        onSelectContact();
        onOpenChange(false);
      },
    },
    {
      id: 'poll',
      label: 'Enquete',
      icon: <BarChart3 className="h-6 w-6" />,
      color: 'bg-yellow-500 hover:bg-yellow-600',
      onClick: () => {
        onSelectPoll();
        onOpenChange(false);
      },
    },
    {
      id: 'event',
      label: 'Evento',
      icon: <Calendar className="h-6 w-6" />,
      color: 'bg-indigo-500 hover:bg-indigo-600',
      onClick: () => {
        onSelectEvent();
        onOpenChange(false);
      },
    },
    {
      id: 'sticker',
      label: 'Nova figurinha',
      icon: <Smile className="h-6 w-6" />,
      color: 'bg-teal-500 hover:bg-teal-600',
      onClick: () => {
        onSelectSticker();
        onOpenChange(false);
      },
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px] p-6">
        <div className="grid grid-cols-3 gap-4">
          {options.map((option) => (
            <button
              key={option.id}
              onClick={option.onClick}
              className="flex flex-col items-center gap-2 p-4 rounded-lg hover:bg-accent transition-colors group"
            >
              <div
                className={`${option.color} text-white p-3 rounded-full transition-all group-hover:scale-110`}
              >
                {option.icon}
              </div>
              <span className="text-xs text-center">{option.label}</span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
