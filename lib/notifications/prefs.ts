'use client';

import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_PREFS, NotifPrefs, sanitizePrefs } from './prefs-shared';

export type { NotifPrefs };
export { DEFAULT_PREFS };

// As preferências ficam na conta (GET/PUT /api/notifications/preferences) e valem em qualquer navegador.
// O localStorage é só um cache para a tela abrir já com o valor certo, sem piscar o padrão.
const CACHE_KEY = 'zaapply_notif_prefs_v2';
const EVENT = 'zaapply:notif-prefs';

function readCache(): NotifPrefs {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? sanitizePrefs(JSON.parse(raw)) : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

function writeCache(prefs: NotifPrefs) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(prefs)); } catch { /* sem cache */ }
}

// uma busca por vez, compartilhada entre o sino e a página
let inflight: Promise<NotifPrefs | null> | null = null;
function fetchServerPrefs(): Promise<NotifPrefs | null> {
  inflight ??= fetch('/api/notifications/preferences')
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => (d?.prefs ? sanitizePrefs(d.prefs) : null))
    .catch(() => null)
    .finally(() => { inflight = null; });
  return inflight;
}

export function useNotifPrefs(): [NotifPrefs, (p: NotifPrefs) => Promise<boolean>] {
  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_PREFS);

  useEffect(() => {
    setPrefs(readCache());
    let alive = true;
    fetchServerPrefs().then((p) => {
      if (!alive || !p) return;
      writeCache(p);
      setPrefs(p);
    });
    const onChange = (e: Event) => setPrefs((e as CustomEvent<NotifPrefs>).detail);
    window.addEventListener(EVENT, onChange);
    return () => {
      alive = false;
      window.removeEventListener(EVENT, onChange);
    };
  }, []);

  /** Salva na conta. Devolve false se o servidor recusou (a tela mantém o valor antigo). */
  const save = useCallback(async (next: NotifPrefs): Promise<boolean> => {
    try {
      const res = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      });
      if (!res.ok) return false;
      const saved = sanitizePrefs((await res.json()).prefs);
      writeCache(saved);
      setPrefs(saved);
      window.dispatchEvent(new CustomEvent(EVENT, { detail: saved }));
      return true;
    } catch {
      return false;
    }
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
