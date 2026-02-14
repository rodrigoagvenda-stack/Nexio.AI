'use client';

import { useEffect } from 'react';

/**
 * Componente que mantém o servidor acordado fazendo pings periódicos
 * Evita "cold start" após períodos de inatividade
 */
export function KeepAlive() {
  useEffect(() => {
    // Fazer ping inicial após 1 minuto (dar tempo do app carregar)
    const initialTimeout = setTimeout(() => {
      fetch('/api/health', { method: 'GET' }).catch(() => {
        // Silenciar erros - é só um heartbeat
      });
    }, 60000); // 1 minuto

    // Fazer ping a cada 5 minutos para manter servidor acordado
    const interval = setInterval(() => {
      fetch('/api/health', { method: 'GET' }).catch(() => {
        // Silenciar erros - é só um heartbeat
      });
    }, 5 * 60 * 1000); // 5 minutos

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, []);

  // Componente não renderiza nada
  return null;
}
