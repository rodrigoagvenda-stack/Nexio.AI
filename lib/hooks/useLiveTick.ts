'use client';

import { useEffect, useState } from 'react';

/**
 * Contador que sobe a cada `intervalMs` enquanto a aba está visível, e também assim que o usuário volta pra aba.
 * Usado como dependência de useEffect pra os números do dashboard se atualizarem sozinhos (sem F5), já que eles
 * vêm de agregações no servidor e não de uma assinatura em tempo real de uma tabela só.
 */
export function useLiveTick(intervalMs = 30_000): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const bump = () => { if (!document.hidden) setTick((t) => t + 1); };
    const id = setInterval(bump, intervalMs);
    document.addEventListener('visibilitychange', bump);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', bump);
    };
  }, [intervalMs]);
  return tick;
}
