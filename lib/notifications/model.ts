import { isToday, format } from 'date-fns';
import type { NotifPrefs } from './prefs-shared';

// Uma notificação na tela vem de duas fontes:
//  - activity_logs: avisos do sistema (SDR pediu uma pessoa, teste do SDR) e ações da própria pessoa
//  - mensagens_do_whatsapp: mensagens recebidas, agrupadas por conversa
export type NotifKind = 'attention' | 'message' | 'activity';
export type NotifGroup = 'handoff' | 'billing' | 'messages' | 'own';
export type NotifIconName = 'hand' | 'clock' | 'alert' | 'card' | 'plug' | 'bolt';

export interface NotifItem {
  id: string;
  kind: NotifKind;
  group: NotifGroup;
  icon: NotifIconName;
  title: string;
  body: string;
  created_at: string;
  read: boolean;
  /** id da linha em activity_logs (só avisos do sistema) */
  logId?: string;
  conversationId?: string;
  href?: string;
  actionLabel?: string;
  photo?: string | null;
  initials?: string;
}

export interface ActivityLogRow {
  id: number | string;
  action: string | null;
  description: string | null;
  created_at: string;
  read: boolean | null;
  metadata?: Record<string, any> | null;
}

export interface InboundMessageRow {
  id: number | string;
  id_da_conversacao: number | string | null;
  texto_da_mensagem: string | null;
  carimbo_de_data_e_hora: string;
  conversas_do_whatsapp?: { nome_do_contato?: string | null; whatsapp_photo_url?: string | null } | null;
}

/** Separa a frase de destaque do resto do texto salvo em `description`. */
export function splitSentence(text: string): { title: string; body: string } {
  const t = text.trim();
  const colon = t.indexOf(' : ');
  if (colon > 0 && colon <= 120) return { title: t.slice(0, colon).trim(), body: t.slice(colon + 3).trim() };
  const m = t.match(/^([\s\S]{8,160}?[.!?])\s+([\s\S]*)$/);
  if (m) return { title: m[1].replace(/\.$/, '').trim(), body: m[2].trim() };
  return { title: t.replace(/\.$/, ''), body: '' };
}

export function logToItem(log: ActivityLogRow): NotifItem {
  const action = log.action ?? '';
  const meta = log.metadata ?? {};
  const text = log.description ?? action;
  const { title, body } = splitSentence(text);
  const conversationId = meta.conversation_id != null ? String(meta.conversation_id) : undefined;
  const base = { id: `log-${log.id}`, logId: String(log.id), created_at: log.created_at, read: !!log.read, title, body, conversationId };

  if (action === 'sdr_handoff') {
    const parou = String(meta.reason ?? '').startsWith('lead_nao_responde');
    return {
      ...base, kind: 'attention', group: 'handoff', icon: parou ? 'clock' : 'hand',
      href: conversationId ? `/atendimento?convId=${conversationId}` : '/atendimento', actionLabel: 'Abrir conversa',
    };
  }
  if (action === 'sdr_agent_ready') {
    return { ...base, kind: 'attention', group: 'handoff', icon: 'bolt', href: '/configuracoes/sdr', actionLabel: 'Testar o agente' };
  }
  if (action === 'sdr_quality_alert') {
    return { ...base, kind: 'attention', group: 'handoff', icon: 'alert', href: '/configuracoes/sdr', actionLabel: 'Revisar o SDR' };
  }
  if (/pagamento|payment|cobran|quota|franquia|plano/i.test(action)) {
    return { ...base, kind: 'attention', group: 'billing', icon: 'card', href: '/planos', actionLabel: 'Ver plano' };
  }
  if (/desconect|disconnect|conexao|conexão/i.test(action)) {
    return { ...base, kind: 'attention', group: 'billing', icon: 'plug', href: '/configuracoes/sdr', actionLabel: 'Reconectar' };
  }
  return { ...base, kind: 'activity', group: 'own', icon: 'bolt' };
}

const initialsOf = (name: string) =>
  name.split(/\s+/).filter(Boolean).map((p) => p[0]).join('').slice(0, 2).toUpperCase() || 'Z';

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/** Uma linha por conversa, não por mensagem. `seen` guarda até quando cada conversa foi vista. */
export function groupMessages(rows: InboundMessageRow[], seen: Record<string, string>, floor: string | null): NotifItem[] {
  const byConv = new Map<string, InboundMessageRow[]>();
  for (const r of rows) {
    if (r.id_da_conversacao == null) continue;
    const key = String(r.id_da_conversacao);
    byConv.set(key, [...(byConv.get(key) ?? []), r]);
  }
  const items: NotifItem[] = [];
  byConv.forEach((list, convId) => {
    const sorted = [...list].sort((a, b) => +new Date(b.carimbo_de_data_e_hora) - +new Date(a.carimbo_de_data_e_hora));
    const last = sorted[0];
    const cutoff = Math.max(seen[convId] ? +new Date(seen[convId]) : 0, floor ? +new Date(floor) : 0);
    const unread = sorted.filter((m) => +new Date(m.carimbo_de_data_e_hora) > cutoff).length;
    const name = last.conversas_do_whatsapp?.nome_do_contato || 'Nova mensagem';
    const text = clip((last.texto_da_mensagem || 'Arquivo de mídia').replace(/\s+/g, ' ').trim(), 70);
    items.push({
      id: `conv-${convId}`, kind: 'message', group: 'messages', icon: 'bolt',
      title: name,
      body: unread > 1 ? `${unread} mensagens novas. A última: "${text}"` : `"${text}"`,
      created_at: last.carimbo_de_data_e_hora, read: unread === 0,
      conversationId: convId, href: `/atendimento?convId=${convId}`, actionLabel: 'Abrir conversa',
      photo: last.conversas_do_whatsapp?.whatsapp_photo_url ?? null, initials: initialsOf(name),
    });
  });
  return items;
}

/** Hoje mostra a hora, antes de hoje mostra o dia. */
export function shortDate(iso: string) {
  const d = new Date(iso);
  return isToday(d) ? format(d, 'HH:mm') : format(d, 'dd/MM');
}

export function longDate(iso: string) {
  const d = new Date(iso);
  return isToday(d) ? `hoje às ${format(d, 'HH:mm')}` : `${format(d, 'dd/MM')} às ${format(d, 'HH:mm')}`;
}

export type NotifTab = 'attention' | 'message' | 'activity' | 'all';

/** O que cada aba lista. "Tudo" só inclui as ações da própria pessoa se ela ligou nas preferências. */
export function itemsForTab(items: NotifItem[], tab: NotifTab, prefs: NotifPrefs): NotifItem[] {
  switch (tab) {
    case 'attention': return items.filter((i) => i.kind === 'attention');
    case 'message': return items.filter((i) => i.kind === 'message');
    case 'activity': return items.filter((i) => i.kind === 'activity');
    default: return items.filter((i) => i.kind !== 'activity' || prefs.ownActions);
  }
}

/** Preferência que liga ou desliga o aviso (contador, som, navegador) deste item. */
export function alertsEnabled(item: NotifItem, prefs: NotifPrefs): boolean {
  switch (item.group) {
    case 'handoff': return prefs.handoff;
    case 'billing': return prefs.billing;
    case 'messages': return prefs.messages;
    default: return prefs.ownActions;
  }
}
