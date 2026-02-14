'use client';

import { useEffect, useRef } from 'react';

/**
 * Componente que mantém o servidor e banco de dados acordados.
 * Faz ping real no Supabase via /api/health a cada 4 minutos.
 * Evita cold start e conexões mortas após inatividade.
 */
export function KeepAlive() {
  const isFirstRun = useRef(true);

  useEffect(() => {
    const ping = async () => {
      try {
        const res = await fetch('/api/health', { method: 'GET' });
        if (!res.ok) {
          console.warn('[KeepAlive] Health check retornou:', res.status);
        }
      } catch {
        // Silenciar erros de rede - é só um heartbeat
      }
    };

    // Primeiro ping após 30s (dar tempo do app carregar)
    const initialTimeout = setTimeout(() => {
      ping();
      isFirstRun.current = false;
    }, 30000);

    // Pings a cada 4 minutos para manter servidor + banco acordados
    const interval = setInterval(ping, 4 * 60 * 1000);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, []);

  return null;
}
