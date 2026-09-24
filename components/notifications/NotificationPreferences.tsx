'use client';

import { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { NotifPrefs, useNotifPrefs } from '@/lib/notifications/prefs';

const SYS = 'system-ui, sans-serif';

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className="flex-shrink-0 transition-colors"
      style={{ width: 46, height: 26, borderRadius: 13, padding: 3, display: 'flex', justifyContent: on ? 'flex-end' : 'flex-start', background: on ? '#01573C' : '#262626' }}
    >
      <span style={{ width: 20, height: 20, borderRadius: 10, background: on ? '#fff' : '#777', transition: 'background .15s' }} />
    </button>
  );
}

interface RowDef {
  key: keyof NotifPrefs;
  title: string;
  desc: string;
}

const HOW: RowDef[] = [
  { key: 'sound', title: 'Tocar um som quando chegar mensagem', desc: 'Só toca com o Zaapply aberto no navegador.' },
  { key: 'desktop', title: 'Avisar no navegador com o Zaapply em segundo plano', desc: 'O navegador vai pedir a sua permissão ao ligar. Não avisa com a aba fechada.' },
];
const WHAT: RowDef[] = [
  { key: 'handoff', title: 'Pedidos de ajuda do agente', desc: 'Quando o agente para e precisa de uma pessoa.' },
  { key: 'messages', title: 'Mensagens novas de leads', desc: 'Uma linha por conversa, não por mensagem.' },
  { key: 'billing', title: 'Pagamento, franquia e conexão', desc: 'Cobrança que falhou, franquia no fim e WhatsApp desconectado.' },
  { key: 'ownActions', title: 'Minhas próprias ações', desc: 'Mover lead, editar e buscas no Orbit. Ficam só na aba Atividade.' },
];

function Section({ label, rows, draft, onToggle }: { label: string; rows: RowDef[]; draft: NotifPrefs; onToggle: (k: keyof NotifPrefs, v: boolean) => void }) {
  return (
    <div className="flex flex-col" style={{ gap: 6 }}>
      <div style={{ color: '#737373', fontFamily: SYS, fontSize: 12, fontWeight: 600, letterSpacing: '0.12em', lineHeight: '16px' }}>{label}</div>
      {rows.map((r, i) => (
        <div
          key={r.key}
          className="flex items-start justify-between"
          style={{ gap: 20, padding: '16px 0', borderBottom: i < rows.length - 1 ? '1px solid #1C1C1C' : 0 }}
        >
          <div className="flex flex-col" style={{ gap: 4 }}>
            <div style={{ color: '#fff', fontFamily: SYS, fontSize: 16, fontWeight: 500, lineHeight: '20px' }}>{r.title}</div>
            <div style={{ color: '#8A8A8A', fontFamily: SYS, fontSize: 14, lineHeight: '20px' }}>{r.desc}</div>
          </div>
          <Toggle on={draft[r.key]} onChange={(v) => onToggle(r.key, v)} label={r.title} />
        </div>
      ))}
    </div>
  );
}

export function NotificationPreferences({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [prefs, savePrefs] = useNotifPrefs();
  const [draft, setDraft] = useState<NotifPrefs>(prefs);

  // Cada vez que abre, parte do que está salvo; "Cancelar" descarta o que mudou.
  useEffect(() => { if (open) setDraft(prefs); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = async (key: keyof NotifPrefs, value: boolean) => {
    if (key === 'desktop' && value) {
      if (typeof Notification === 'undefined') {
        toast({ variant: 'destructive', title: 'Este navegador não permite avisos', description: 'Use o som e o sino do Zaapply.' });
        return;
      }
      const permission = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
      if (permission !== 'granted') {
        toast({ variant: 'destructive', title: 'O navegador bloqueou os avisos', description: 'Libere as notificações do Zaapply nas configurações do navegador e tente de novo.' });
        return;
      }
    }
    setDraft((d) => ({ ...d, [key]: value }));
  };

  const save = () => {
    savePrefs(draft);
    onOpenChange(false);
    toast({ title: 'Preferências salvas', description: 'Valem neste navegador.' });
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-y-0 right-0 z-50 flex flex-col w-full max-w-[520px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right data-[state=closed]:duration-200 data-[state=open]:duration-300 focus:outline-none"
          style={{ background: '#101010', borderLeft: '1px solid #1C1C1C', fontFamily: SYS }}
        >
          <div className="flex items-center justify-between" style={{ padding: '28px 32px', borderBottom: '1px solid #1C1C1C' }}>
            <Dialog.Title style={{ color: '#fff', fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em', lineHeight: '28px' }}>
              Preferências de notificação
            </Dialog.Title>
            <Dialog.Close
              aria-label="Fechar"
              className="flex items-center justify-center flex-shrink-0 hover:bg-white/5 transition-colors"
              style={{ width: 36, height: 36, borderRadius: 18, background: '#141414', border: '1px solid #262626' }}
            >
              <X size={16} color="#fff" />
            </Dialog.Close>
          </div>

          <div className="flex flex-1 flex-col overflow-y-auto" style={{ gap: 32, padding: '28px 32px' }}>
            <Section label="COMO AVISAR" rows={HOW} draft={draft} onToggle={toggle} />
            <Section label="O QUE AVISAR" rows={WHAT} draft={draft} onToggle={toggle} />
          </div>

          <div className="flex items-center justify-end" style={{ gap: 12, padding: '20px 32px', borderTop: '1px solid #1C1C1C' }}>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="transition-transform active:translate-y-0.5"
              style={{ height: 48, padding: '0 24px', borderRadius: 999, background: '#141414', border: '1px solid #262626', boxShadow: '0 3px 0 #050505', color: '#fff', fontSize: 15, fontWeight: 500 }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={save}
              className="transition-transform active:translate-y-0.5"
              style={{ height: 48, padding: '0 28px', borderRadius: 999, background: '#01573C', boxShadow: '0 3px 0 #013825', color: '#fff', fontSize: 15, fontWeight: 600 }}
            >
              Salvar preferências
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
