import { useState, useCallback } from 'react';

/**
 * Hook para aplicar máscara de telefone brasileira
 * Detecta automaticamente se é fixo ou móvel
 * - Fixo: (XX) XXXX-XXXX
 * - Móvel: (XX) 9XXXX-XXXX
 */
export function usePhoneMask() {
  const applyPhoneMask = useCallback((value: string) => {
    // Remove tudo que não é número
    const cleaned = value.replace(/\D/g, '');

    // Se não tem nada, retorna vazio
    if (!cleaned) return '';

    // Aplica a máscara progressivamente
    let masked = cleaned;

    // Adiciona parênteses no DDD
    if (cleaned.length > 0) {
      masked = `(${cleaned.slice(0, 2)}`;
    }

    if (cleaned.length >= 3) {
      masked = `(${cleaned.slice(0, 2)}) ${cleaned.slice(2)}`;
    }

    // Detecta se é móvel (3º dígito é 9) ou fixo
    const isMobile = cleaned.length >= 3 && cleaned[2] === '9';

    if (isMobile) {
      // Móvel: (XX) 9XXXX-XXXX
      if (cleaned.length > 7) {
        masked = `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7, 11)}`;
      } else if (cleaned.length > 2) {
        masked = `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}`;
      }
    } else {
      // Fixo: (XX) XXXX-XXXX
      if (cleaned.length > 6) {
        masked = `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6, 10)}`;
      } else if (cleaned.length > 2) {
        masked = `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}`;
      }
    }

    return masked;
  }, []);

  const removeMask = useCallback((value: string) => {
    return value.replace(/\D/g, '');
  }, []);

  return { applyPhoneMask, removeMask };
}
