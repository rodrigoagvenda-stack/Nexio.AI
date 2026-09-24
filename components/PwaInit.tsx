'use client';

import { useEffect } from 'react';

// Só registra o service worker. A permissão de notificação NÃO é pedida aqui: antes o site perguntava
// sozinho assim que abria. Agora a pessoa liga em Notificações > Preferências
// ("Avisar no navegador com a aba fechada"), ver lib/notifications/push.ts.
export function PwaInit() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((err) => {
      console.warn('[PwaInit] SW error:', err);
    });
  }, []);

  return null;
}
