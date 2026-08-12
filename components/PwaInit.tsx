'use client';

import { useEffect } from 'react';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

async function registerAndSubscribe() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;

    if (!VAPID_PUBLIC_KEY) return;

    const existingSubscription = await reg.pushManager.getSubscription();
    if (existingSubscription) return; // already subscribed

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;

    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });

    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscription.toJSON()),
    });
  } catch (err) {
    console.warn('[PwaInit] SW/Push setup error:', err);
  }
}

export function PwaInit() {
  useEffect(() => {
    registerAndSubscribe();
  }, []);

  return null;
}
