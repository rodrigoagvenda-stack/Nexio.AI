'use client';

import { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { NotifPrefs, useNotifPrefs } from '@/lib/notifications/prefs';
import { PushState, disablePush, enablePush, getPushState, pushAvailable } from '@/lib/notifications/push';

const SYS = 'system-ui, sans-serif';

function Toggle({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className="flex-shrink-0 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      style={{ width: 46, height: 26, borderRadius: 13, padding: 3, display: 'flex', justifyContent: on ? 'flex-end' : 'flex-start', background: on ? '#01573C' : '#262626' }}
    >
      <span style={{ width: 20, height: 20, borderRadius: 10, background: on ? '#fff' : '#777', transition: 'background .15s' }} />
    </button>
  );
}

function Row({ title, desc, last, control }: { title: string; desc: string; last?: boolean; control: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between" style={{ gap: 20, padding: '16px 0', borderBottom: last ? 0 : '1px solid #1C1C1C' }}>
      <div className="flex flex-col" style={{ gap: 4 }}>
        <div style={{ color: '#fff', fontFamily: SYS, fontSize: 16, fontWeight: 500, lineHeight: '20px' }}>{title}</div>
        <div style={{ color: '#8A8A8A', fontFamily: SYS, fontSize: 14, lineHeight: '20px' }}>{desc}</div>
      </div>
      {control}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ color: '#737373', fontFamily: SYS, fontSize: 12, fontWeight: 600, letterSpacing: '0.12em', lineHeight: '16px' }}>{children}</div>;
}

const WHAT: { key: keyof NotifPrefs; title: string; desc: string }[] = [
  { key: 'handoff', title: 'Pedidos de ajuda do agente', desc: 'Quando o agente para e precisa de uma pessoa.' },
  { key: 'messages', title: 'Mensagens novas de leads', desc: 'Uma linha por conversa, não por mensagem.' },
  { key: 'billing', title: 'Pagamento, franquia e conexão', desc: 'Cobrança que falhou, franquia no fim e WhatsApp desconectado.' },
  { key: 'ownActions', title: 'Minhas próprias ações', desc: 'Mover lead, editar e buscas no Orbit. Ficam só na aba Atividade.' },
];

const PUSH_DESC: Record<'default' | 'unsupported' | 'blocked' | 'unavailable', string> = {
  default: 'O navegador vai pedir a sua permissão ao ligar.',
  unsupported: 'Este navegador não permite avisos com a aba fechada.',
  blocked: 'O navegador bloqueou. Libere as notificações do Zaapply nas configurações do navegador.',
  unavailable: 'Ainda não está disponível neste ambiente.',
};

export function NotificationPreferences({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [prefs, savePrefs] = useNotifPrefs();
  const [draft, setDraft] = useState<NotifPrefs>(prefs);
  const [saving, setSaving] = useState(false);
  const [push, setPush] = useState<PushState | null>(null);
  const [pushReady, setPushReady] = useState(true);
  const [pushBusy, setPushBusy] = useState(false);

  // Cada vez que abre, parte do que está salvo; "Cancelar" descarta o que mudou.
  useEffect(() => {
    if (!open) return;
    setDraft(prefs);
    getPushState().then(setPush);
    pushAvailable().then(setPushReady);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // O aviso com a aba fechada é deste aparelho e vale na hora: o navegador exige o clique para pedir permissão.
  const togglePush = async (value: boolean) => {
    setPushBusy(true);
    try {
      if (!value) {
        await disablePush();
        setPush('off');
        return;
      }
      const result = await enablePush();
      if (result.ok) {
        setPush('on');
        return;
      }
      setPush(await getPushState());
      if (result.reason === 'denied') {
        toast({ variant: 'destructive', title: 'O navegador bloqueou os avisos', description: 'Libere as notificações do Zaapply nas configurações do navegador e tente de novo.' });
      } else if (result.reason === 'not-configured') {
        setPushReady(false);
      } else if (result.reason === 'unsupported') {
        toast({ variant: 'destructive', title: 'Este navegador não permite esse aviso' });
      } else {
        toast({ variant: 'destructive', title: 'Não foi possível ligar o aviso', description: 'Tente de novo em instantes.' });
      }
    } finally {
      setPushBusy(false);
    }
  };

  const save = async () => {
    setSaving(true);
    const ok = await savePrefs(draft);
    setSaving(false);
    if (!ok) {
      toast({ variant: 'destructive', title: 'Não foi possível salvar', description: 'Nada foi alterado. Tente de novo.' });
      return;
    }
    onOpenChange(false);
    toast({ title: 'Preferências salvas' });
  };

  const pushKind = push === 'unsupported' ? 'unsupported' : push === 'blocked' ? 'blocked' : !pushReady ? 'unavailable' : 'default';
  const pushDisabled = pushBusy || push === null || pushKind !== 'default';

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
            <div className="flex flex-col" style={{ gap: 6 }}>
              <Label>COMO AVISAR</Label>
              <Row
                title="Tocar um som quando chegar mensagem"
                desc="Só toca com o Zaapply aberto no navegador."
                control={<Toggle on={draft.sound} onChange={(v) => setDraft((d) => ({ ...d, sound: v }))} label="Tocar um som quando chegar mensagem" />}
              />
              <Row
                title="Avisar no navegador com a aba fechada"
                desc={PUSH_DESC[pushKind]}
                last
                control={<Toggle on={push === 'on'} onChange={togglePush} disabled={pushDisabled} label="Avisar no navegador com a aba fechada" />}
              />
            </div>

            <div className="flex flex-col" style={{ gap: 6 }}>
              <Label>O QUE AVISAR</Label>
              {WHAT.map((r, i) => (
                <Row
                  key={r.key}
                  title={r.title}
                  desc={r.desc}
                  last={i === WHAT.length - 1}
                  control={<Toggle on={draft[r.key]} onChange={(v) => setDraft((d) => ({ ...d, [r.key]: v }))} label={r.title} />}
                />
              ))}
            </div>
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
              disabled={saving}
              className="transition-transform active:translate-y-0.5 disabled:opacity-60"
              style={{ height: 48, padding: '0 28px', borderRadius: 999, background: '#01573C', boxShadow: '0 3px 0 #013825', color: '#fff', fontSize: 15, fontWeight: 600 }}
            >
              {saving ? 'Salvando…' : 'Salvar preferências'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
