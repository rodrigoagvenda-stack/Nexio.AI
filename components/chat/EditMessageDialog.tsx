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
import { Loader2 } from 'lucide-react';

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

  useEffect(() => {
    setEditedMessage(message);
  }, [message]);

  const handleSave = async () => {
    if (!editedMessage.trim() || editedMessage === message) {
      onOpenChange(false);
      return;
    }

    setSaving(true);
    try {
      await onSave(editedMessage);
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving edited message:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar mensagem</DialogTitle>
          <DialogDescription>
            Faça as alterações desejadas na mensagem e clique em salvar.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Textarea
            value={editedMessage}
            onChange={(e) => setEditedMessage(e.target.value)}
            placeholder="Digite a mensagem..."
            className="min-h-[100px]"
            disabled={saving}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving || !editedMessage.trim() || editedMessage === message}
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
