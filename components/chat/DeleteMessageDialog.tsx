'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

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
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Apagar mensagem?</AlertDialogTitle>
          <AlertDialogDescription>
            Escolha como deseja apagar esta mensagem.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-col gap-2">
          <AlertDialogAction
            onClick={() => {
              onDeleteForMe();
              onOpenChange(false);
            }}
            className="w-full"
          >
            Apagar para mim
          </AlertDialogAction>
          {canDeleteForEveryone && (
            <AlertDialogAction
              onClick={() => {
                onDeleteForEveryone();
                onOpenChange(false);
              }}
              className="w-full bg-destructive hover:bg-destructive/90"
            >
              Apagar para todos
            </AlertDialogAction>
          )}
          <AlertDialogCancel className="w-full">Cancelar</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
