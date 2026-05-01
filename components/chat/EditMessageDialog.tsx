'use client';

import { useState, useEffect, useRef } from 'react';
import { Pencil } from 'lucide-react';

interface EditMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: string;
  onSave: (newMessage: string) => Promise<void>;
}

export function EditMessageDialog({ open, onOpenChange, message, onSave }: EditMessageDialogProps) {
  const [editedMessage, setEditedMessage] = useState(message);
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setEditedMessage(message);
  }, [message]);

  useEffect(() => {
    if (open) setTimeout(() => {
      textareaRef.current?.focus();
      const len = textareaRef.current?.value.length ?? 0;
      textareaRef.current?.setSelectionRange(len, len);
    }, 50);
  }, [open]);

  async function handleSave() {
    if (!editedMessage.trim() || editedMessage.trim() === message.trim()) { onOpenChange(false); return; }
    setSaving(true);
    try { await onSave(editedMessage.trim()); onOpenChange(false); }
    catch {}
    finally { setSaving(false); }
  }

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px]" onClick={() => onOpenChange(false)} />
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0">
        <div className="w-full max-w-sm bg-[#1f2c34] rounded-2xl overflow-hidden shadow-2xl animate-in slide-in-from-bottom-4 duration-200">
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10">
            <Pencil className="w-4 h-4 text-[#00a884]" />
            <span className="text-white font-medium text-sm">Editar mensagem</span>
          </div>

          {/* Textarea */}
          <div className="px-4 py-3">
            <textarea
              ref={textareaRef}
              value={editedMessage}
              onChange={e => setEditedMessage(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSave(); } }}
              placeholder="Digite a mensagem..."
              rows={3}
              disabled={saving}
              className="w-full bg-[#2a3942] text-white text-sm rounded-xl px-4 py-3 resize-none outline-none placeholder:text-[#8696a0] focus:ring-1 focus:ring-[#00a884]/50"
            />
            <p className="text-xs text-[#8696a0] mt-1 px-1">Enter para salvar · Shift+Enter para nova linha</p>
          </div>

          {/* Ações */}
          <div className="flex border-t border-white/10">
            <button
              onClick={() => onOpenChange(false)}
              disabled={saving}
              className="flex-1 py-4 text-sm text-[#8696a0] hover:bg-white/5 transition-colors border-r border-white/10"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={!editedMessage.trim() || saving}
              className="flex-1 py-4 text-sm font-medium text-[#00a884] hover:bg-white/5 transition-colors disabled:opacity-40"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
