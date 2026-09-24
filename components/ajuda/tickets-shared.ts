export interface SupportTicket {
  id: string;
  protocolo: string;
  assunto: string;
  mensagem: string;
  status: 'aberto' | 'em_atendimento' | 'respondido' | 'fechado';
  resposta: string | null;
  respondido_em: string | null;
  created_at: string;
  images?: string[];
}

export interface TicketMessage {
  id: string;
  sender_type: 'user' | 'support';
  content: string;
  created_at: string;
}

/** Categorias do chamado e o prazo de resposta de cada uma (em horas úteis). */
export const TICKET_CATEGORIES = [
  { value: 'WhatsApp / Conexão', hours: 2 },
  { value: 'Agente IA não responde', hours: 4 },
  { value: 'Problema técnico', hours: 4 },
  { value: 'Cobrança / Pagamento', hours: 24 },
  { value: 'Dúvida sobre funcionalidade', hours: 24 },
  { value: 'Outro', hours: 24 },
] as const;

export const hoursLabel = (h: number) => (h === 1 ? '1 hora' : `${h} horas`);

export const TICKET_MAX_IMAGES = 3;
export const TICKET_MAX_MB = 5;

const SEEN_KEY = 'zaapply_tickets_seen';

export function getSeenTickets(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(SEEN_KEY) ?? '{}'); } catch { return {}; }
}

export function markTicketSeen(id: string, lastAt: string) {
  try {
    const s = getSeenTickets();
    s[id] = lastAt;
    localStorage.setItem(SEEN_KEY, JSON.stringify(s));
  } catch { /* sem armazenamento: o aviso de resposta nova só não some sozinho */ }
}

/** Tem resposta da equipe que a pessoa ainda não viu. */
export function hasUnreadReply(t: SupportTicket, seen: Record<string, string>): boolean {
  if (!t.resposta) return false;
  const last = seen[t.id];
  return !last || (!!t.respondido_em && new Date(t.respondido_em) > new Date(last));
}

export function fmtTicketAge(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return 'agora';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}min`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)} dia${Math.floor(diff / 86_400_000) > 1 ? 's' : ''}`;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

export function fmtTicketDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function fmtMessageDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).replace('.', '');
}
