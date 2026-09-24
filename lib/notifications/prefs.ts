'use client';

import { useCallback, useEffect, useState } from 'react';

// Preferências de notificação, guardadas neste navegador (localStorage).
// Não há tabela no banco para isso ainda: cada pessoa configura em cada navegador.
export interface NotifPrefs {
  /** Toca um som quando chega mensagem ou um aviso que precisa de uma pessoa. */
  sound: boolean;
  /** Mostra um aviso do navegador quando o Zaapply está aberto em segundo plano. */
  desktop: boolean;
  /** "Pedidos de ajuda do agente": o SDR parou e precisa de uma pessoa. */
  handoff: boolean;
  /** Mensagens novas de leads (uma linha por conversa). */
  messages: boolean;
  /** Pagamento, franquia e conexão. */
  billing: boolean;
  /** Ações da própria pessoa (mover lead, editar, buscas no Orbit). */
  ownActions: boolean;
}

export const DEFAULT_PREFS: NotifPrefs = {
  sound: true,
  desktop: false,
  handoff: true,
  messages: true,
  billing: true,
  ownActions: false,
};

const KEY = 'zaapply_notif_prefs_v1';
const EVENT = 'zaapply:notif-prefs';

export function loadPrefs(): NotifPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<NotifPrefs>;
    const next = { ...DEFAULT_PREFS };
    for (const k of Object.keys(DEFAULT_PREFS) as (keyof NotifPrefs)[]) {
      if (typeof parsed[k] === 'boolean') next[k] = parsed[k] as boolean;
    }
    return next;
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(prefs: NotifPrefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch { /* navegador bloqueou o armazenamento: a preferência vale só nesta sessão */ }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: prefs }));
}

export function useNotifPrefs(): [NotifPrefs, (p: NotifPrefs) => void] {
  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_PREFS);

  useEffect(() => {
    setPrefs(loadPrefs());
    const onChange = (e: Event) => setPrefs((e as CustomEvent<NotifPrefs>).detail ?? loadPrefs());
    const onStorage = (e: StorageEvent) => { if (e.key === KEY) setPrefs(loadPrefs()); };
    window.addEventListener(EVENT, onChange);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const save = useCallback((p: NotifPrefs) => {
    setPrefs(p);
    savePrefs(p);
  }, []);

  return [prefs, save];
}

let audioCtx: AudioContext | null = null;

/** Dois tons curtos gerados no navegador (sem arquivo de áudio). Some em silêncio se o navegador bloquear. */
export function playNotifSound() {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    audioCtx = audioCtx ?? new Ctx();
    if (audioCtx.state === 'suspended') void audioCtx.resume();
    const now = audioCtx.currentTime;
    [880, 1318].forEach((freq, i) => {
      const osc = audioCtx!.createOscillator();
      const gain = audioCtx!.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const start = now + i * 0.14;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.09, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
      osc.connect(gain).connect(audioCtx!.destination);
      osc.start(start);
      osc.stop(start + 0.18);
    });
  } catch { /* sem áudio */ }
}

/** Aviso do navegador. Só aparece com o Zaapply aberto em outra aba ou janela; com a aba fechada não chega. */
export function showBrowserNotification(title: string, body: string, tag: string) {
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    if (!document.hidden) return;
    const n = new Notification(title, { body, tag, icon: '/favicon.ico' });
    n.onclick = () => { window.focus(); n.close(); };
  } catch { /* sem suporte */ }
}
