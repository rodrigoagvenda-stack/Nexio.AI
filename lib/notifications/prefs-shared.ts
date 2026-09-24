// Preferências de notificação da pessoa. Ficam na conta (tabela user_notification_prefs), então
// valem em qualquer navegador. Este arquivo é usado pelo navegador e pelo servidor.
// "Avisar no navegador com a aba fechada" NÃO está aqui: é uma escolha de cada aparelho
// (a inscrição de push mora naquele navegador), ver lib/notifications/push.ts.
export interface NotifPrefs {
  /** Toca um som quando chega mensagem ou um aviso que precisa de uma pessoa. */
  sound: boolean;
  /** "Pedidos de ajuda do agente": o SDR parou e precisa de uma pessoa. */
  handoff: boolean;
  /** Mensagens novas de leads (uma linha por conversa). */
  messages: boolean;
  /** Pagamento, franquia e conexão. */
  billing: boolean;
  /** Ações da própria pessoa (mover lead, editar, buscas no Orbit). */
  ownActions: boolean;
}

export const DEFAULT_PREFS: NotifPrefs = {
  sound: true,
  handoff: true,
  messages: true,
  billing: true,
  ownActions: false,
};

export const PREF_KEYS = Object.keys(DEFAULT_PREFS) as (keyof NotifPrefs)[];

/** Aceita qualquer coisa e devolve preferências completas: só valores booleanos passam, o resto vira o padrão. */
export function sanitizePrefs(input: unknown): NotifPrefs {
  const src = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const out = { ...DEFAULT_PREFS };
  for (const k of PREF_KEYS) {
    if (typeof src[k] === 'boolean') out[k] = src[k] as boolean;
  }
  return out;
}
