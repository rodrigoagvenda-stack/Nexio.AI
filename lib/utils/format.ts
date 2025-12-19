import { format as dateFnsFormat } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function formatDate(date: string | Date, formatStr: string = 'dd/MM/yyyy'): string {
  return dateFnsFormat(new Date(date), formatStr, { locale: ptBR });
}

export function formatDateTime(date: string | Date): string {
  return dateFnsFormat(new Date(date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');

  if (cleaned.length === 11) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
  } else if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
  }

  return phone;
}

export function formatWhatsApp(phone: string): string {
  // Remove todos os caracteres não numéricos
  const cleaned = phone.replace(/\D/g, '');

  // Se já começa com 55, retorna
  if (cleaned.startsWith('55')) {
    return cleaned;
  }

  // Adiciona 55 (Brasil)
  return `55${cleaned}`;
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}
