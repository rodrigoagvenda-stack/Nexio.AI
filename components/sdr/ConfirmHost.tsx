'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PILL3D, PILL_GREEN } from './ui';

// Confirmação no estilo do Zaapply, no lugar do window.confirm do navegador.
// Uso: if (!(await askConfirm('Desconectar o WhatsApp?'))) return;   (e <ConfirmHost /> montado uma vez na tela)
type Ask = { message: string; resolve: (ok: boolean) => void };
let listener: ((a: Ask) => void) | null = null;

export function askConfirm(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (!listener) { resolve(typeof window !== 'undefined' ? window.confirm(message) : false); return; }
    listener({ message, resolve });
  });
}

const DANGER = /^(Desconectar|Remover|Apagar|Descartar)/i;

export function ConfirmHost() {
  const [ask, setAsk] = useState<Ask | null>(null);

  useEffect(() => {
    listener = (a) => setAsk(a);
    return () => { listener = null; };
  }, []);

  function close(ok: boolean) {
    ask?.resolve(ok);
    setAsk(null);
  }

  const danger = ask ? DANGER.test(ask.message) : false;

  return (
    <Dialog open={!!ask} onOpenChange={(v) => { if (!v) close(false); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{danger ? 'Tem certeza?' : 'Confirmar'}</DialogTitle>
          <DialogDescription className="text-[15px] leading-[150%]">{ask?.message}</DialogDescription>
        </DialogHeader>
        <div className="mt-2 flex flex-wrap items-center justify-end gap-3">
          <button type="button" onClick={() => close(false)} className={PILL3D}>Cancelar</button>
          <button type="button" onClick={() => close(true)} className={danger ? 'flex h-11 items-center justify-center gap-2 rounded-full bg-[#B42318] px-6 text-[15px] font-semibold text-white shadow-[inset_0_1px_0_#FFFFFF26,0_3px_0_#7A1810] transition-transform active:translate-y-px' : PILL_GREEN}>{danger ? 'Sim, continuar' : 'Confirmar'}</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
