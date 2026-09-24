'use client';

// Aviso do navegador com a aba fechada (Web Push), neste aparelho.
// A inscrição mora no navegador, então é uma escolha de cada aparelho, não da conta.

export type PushState = 'unsupported' | 'blocked' | 'off' | 'on';
export type EnableResult = { ok: true } | { ok: false; reason: 'unsupported' | 'denied' | 'not-configured' | 'error' };

function supported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

function keyToBytes(base64: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = window.atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out.buffer.slice(0);
}

async function registration() {
  const existing = await navigator.serviceWorker.getRegistration('/');
  return existing ?? (await navigator.serviceWorker.register('/sw.js', { scope: '/' }));
}

export async function getPushState(): Promise<PushState> {
  if (!supported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  try {
    const reg = await navigator.serviceWorker.getRegistration('/');
    const sub = await reg?.pushManager.getSubscription();
    return sub && Notification.permission === 'granted' ? 'on' : 'off';
  } catch {
    return 'off';
  }
}

/** O servidor só oferece o aviso se tiver as chaves VAPID configuradas. */
export async function pushAvailable(): Promise<boolean> {
  try {
    const res = await fetch('/api/push/subscribe');
    const data = await res.json();
    return !!data.publicKey;
  } catch {
    return false;
  }
}

export async function enablePush(): Promise<EnableResult> {
  if (!supported()) return { ok: false, reason: 'unsupported' };
  try {
    const res = await fetch('/api/push/subscribe');
    const { publicKey } = await res.json();
    if (!publicKey) return { ok: false, reason: 'not-configured' };

    const permission = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
    if (permission !== 'granted') return { ok: false, reason: 'denied' };

    const reg = await registration();
    await navigator.serviceWorker.ready;
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(publicKey) }));

    const save = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sub.toJSON()),
    });
    if (!save.ok) return { ok: false, reason: 'error' };
    return { ok: true };
  } catch {
    return { ok: false, reason: 'error' };
  }
}

export async function disablePush(): Promise<void> {
  if (!supported()) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration('/');
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return;
    await fetch('/api/push/subscribe', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    });
    await sub.unsubscribe();
  } catch { /* segue: no pior caso a inscrição some sozinha quando o navegador a descartar */ }
}
