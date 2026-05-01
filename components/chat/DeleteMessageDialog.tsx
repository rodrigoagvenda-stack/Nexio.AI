'use client';

import { Trash2 } from 'lucide-react';

interface DeleteMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleteForMe: () => void;
  onDeleteForEveryone: () => void;
  canDeleteForEveryone: boolean;
}

export function DeleteMessageDialog({
  open,
  onOpenChange,
  onDeleteForMe,
  onDeleteForEveryone,
  canDeleteForEveryone,
}: DeleteMessageDialogProps) {
  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px]"
        onClick={() => onOpenChange(false)}
      />

      {/* Sheet centralizado estilo WhatsApp */}
      <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center pb-4 px-4 sm:inset-0 sm:items-center sm:pb-0">
        <div className="w-full max-w-sm bg-[#1f2c34] rounded-2xl overflow-hidden shadow-2xl animate-in slide-in-from-bottom-4 duration-200">
          {/* Ícone + título */}
          <div className="flex flex-col items-center px-6 pt-6 pb-4 gap-3 border-b border-white/10">
            <div className="w-12 h-12 rounded-full bg-red-500/15 flex items-center justify-center">
              <Trash2 className="w-6 h-6 text-red-400" />
            </div>
            <p className="text-white font-medium text-base">Apagar mensagem?</p>
          </div>

          {/* Ações */}
          <div className="flex flex-col">
            {canDeleteForEveryone && (
              <button
                onClick={() => { onDeleteForEveryone(); onOpenChange(false); }}
                className="w-full px-6 py-4 text-left text-red-400 font-medium text-sm hover:bg-white/5 transition-colors border-b border-white/10"
              >
                Apagar para todos
              </button>
            )}
            <button
              onClick={() => { onDeleteForMe(); onOpenChange(false); }}
              className="w-full px-6 py-4 text-left text-[#8696a0] text-sm hover:bg-white/5 transition-colors border-b border-white/10"
            >
              Apagar para mim
            </button>
            <button
              onClick={() => onOpenChange(false)}
              className="w-full px-6 py-4 text-left text-[#00a884] font-medium text-sm hover:bg-white/5 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
