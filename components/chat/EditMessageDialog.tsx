'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface EditMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: string;
  onSave: (newMessage: string) => Promise<void>;
}

export function EditMessageDialog({
  open,
  onOpenChange,
  message,
  onSave,
}: EditMessageDialogProps) {
  const [editedMessage, setEditedMessage] = useState(message);
  const [saving, setSaving] = useState(false);

  // Atualizar o estado quando a mensagem mudar
  useEffect(() => {
    setEditedMessage(message);
  }, [message]);

  async function handleSave() {
    if (!editedMessage.trim()) return;
    if (editedMessage.trim() === message.trim()) {
      onOpenChange(false);
      return;
    }

    setSaving(true);
    try {
      await onSave(editedMessage.trim());
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving edited message:', error);
    } finally {
      setSaving(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Editar mensagem</DialogTitle>
          <DialogDescription>
            Faça as alterações necessárias e clique em salvar.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Textarea
            value={editedMessage}
            onChange={(e) => setEditedMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite a mensagem..."
            className="min-h-[100px] resize-none"
            autoFocus
            disabled={saving}
          />
          <p className="text-xs text-muted-foreground mt-2">
            Pressione Enter para salvar, Shift+Enter para nova linha
          </p>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={!editedMessage.trim() || saving}
            className="bg-[#005c4b] hover:bg-[#004d3d]"
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
