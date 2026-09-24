'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/lib/hooks/useUser';
import {
  ActivityLogRow, InboundMessageRow, NotifItem, alertsEnabled, groupMessages, logToItem,
} from '@/lib/notifications/model';
import { NotifPrefs, playNotifSound, showBrowserNotification, useNotifPrefs } from '@/lib/notifications/prefs';

const SEEN_KEY = 'notif_msg_seen';        // { [conversaId]: ISO } até quando cada conversa foi vista
const FLOOR_KEY = 'notif_msg_last_seen';  // chave antiga: "marcar tudo" antes de existir o controle por conversa

function readSeen(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '{}'); } catch { return {}; }
}

/**
 * Notificações da empresa: avisos do sistema (activity_logs) e mensagens recebidas por conversa.
 * `alerts` liga som e aviso do navegador para o que chega ao vivo: use só em UM lugar (a barra do topo).
 */
export function useNotifications({ alerts = false }: { alerts?: boolean } = {}) {
  const { company } = useUser();
  const pathname = usePathname();
  const [prefs] = useNotifPrefs();
  const [logs, setLogs] = useState<NotifItem[]>([]);
  const [msgs, setMsgs] = useState<NotifItem[]>([]);
  const [loading, setLoading] = useState(true);
  const channelId = useId();

  // O canal ao vivo é criado uma vez; preferências e rota mudam sem recriá-lo.
  const prefsRef = useRef<NotifPrefs>(prefs);
  const pathRef = useRef(pathname);
  useEffect(() => { prefsRef.current = prefs; }, [prefs]);
  useEffect(() => { pathRef.current = pathname; }, [pathname]);

  const fetchAll = useCallback(async () => {
    if (!company?.id) return;
    try {
      const supabase = createClient();
      const [{ data: logRows }, { data: msgRows }] = await Promise.all([
        supabase
          .from('activity_logs')
          .select('id, action, description, created_at, read, metadata')
          .eq('company_id', company.id)
          .order('created_at', { ascending: false })
          .limit(60),
        supabase
          .from('mensagens_do_whatsapp')
          .select('id, id_da_conversacao, texto_da_mensagem, carimbo_de_data_e_hora, conversas_do_whatsapp(nome_do_contato, whatsapp_photo_url)')
          .eq('company_id', company.id)
          .eq('direcao', 'inbound')
          .order('carimbo_de_data_e_hora', { ascending: false })
          .limit(80),
      ]);
      setLogs(((logRows ?? []) as ActivityLogRow[]).map(logToItem));
      setMsgs(groupMessages((msgRows ?? []) as unknown as InboundMessageRow[], readSeen(), localStorage.getItem(FLOOR_KEY)));
    } catch { /* mantém o que já estava na tela */ } finally {
      setLoading(false);
    }
  }, [company?.id]);

  const refreshTimer = useRef<ReturnType<typeof setTimeout>>();
  const refreshSoon = useCallback(() => {
    clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(fetchAll, 400);
  }, [fetchAll]);

  useEffect(() => {
    if (!company?.id) return;
    fetchAll();

    const alertUser = (item: NotifItem) => {
      if (!alerts || !alertsEnabled(item, prefsRef.current)) return;
      // quem já está olhando a tela de Atendimento não precisa de som para as mensagens
      const looking = !document.hidden && pathRef.current?.startsWith('/atendimento');
      if (prefsRef.current.sound && !looking) playNotifSound();
      if (prefsRef.current.desktop) showBrowserNotification(item.title, item.body || 'Abra o Zaapply para ver.', item.id);
    };

    const supabase = createClient();
    const channel = supabase
      .channel(`notifications-${channelId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'activity_logs', filter: `company_id=eq.${company.id}` },
        (payload: any) => {
          alertUser(logToItem(payload.new as ActivityLogRow));
          refreshSoon();
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'mensagens_do_whatsapp', filter: `company_id=eq.${company.id}` },
        (payload: any) => {
          const row = payload.new as { direcao?: string; texto_da_mensagem?: string | null; id_da_conversacao?: number };
          if (row.direcao !== 'inbound') return;
          alertUser({
            id: `conv-${row.id_da_conversacao}`, kind: 'message', group: 'messages', icon: 'bolt',
            title: 'Nova mensagem', body: row.texto_da_mensagem || 'Arquivo de mídia', created_at: new Date().toISOString(), read: false,
          });
          refreshSoon();
        },
      )
      .subscribe();

    return () => {
      clearTimeout(refreshTimer.current);
      supabase.removeChannel(channel);
    };
  }, [company?.id, channelId, alerts, fetchAll, refreshSoon]);

  const items = useMemo(
    () => [...logs, ...msgs].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)),
    [logs, msgs],
  );

  // Só o que está ligado nas preferências entra no contador do sino.
  const counts = useMemo(() => {
    const unread = items.filter((i) => !i.read && alertsEnabled(i, prefs));
    const attention = unread.filter((i) => i.kind === 'attention').length;
    const messages = unread.filter((i) => i.kind === 'message').length;
    const activity = unread.filter((i) => i.kind === 'activity').length;
    return { attention, messages, activity, total: attention + messages + activity };
  }, [items, prefs]);

  const markRead = useCallback(async (item: NotifItem) => {
    if (item.read) return;
    if (item.kind === 'message' && item.conversationId) {
      const seen = readSeen();
      seen[item.conversationId] = new Date().toISOString();
      try { localStorage.setItem(SEEN_KEY, JSON.stringify(seen)); } catch { /* segue sem persistir */ }
      setMsgs((prev) => prev.map((n) => (n.id === item.id ? { ...n, read: true } : n)));
      return;
    }
    if (!item.logId) return;
    setLogs((prev) => prev.map((n) => (n.id === item.id ? { ...n, read: true } : n)));
    try { await fetch(`/api/notifications/${item.logId}/read`, { method: 'POST' }); } catch { /* volta no próximo carregamento */ }
  }, []);

  const markAllRead = useCallback(async () => {
    try { localStorage.setItem(FLOOR_KEY, new Date().toISOString()); } catch { /* segue sem persistir */ }
    setMsgs((prev) => prev.map((n) => ({ ...n, read: true })));
    setLogs((prev) => prev.map((n) => ({ ...n, read: true })));
    // uma chamada só, no lugar de uma requisição por aviso
    try {
      await fetch('/api/notifications/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      });
    } catch { /* volta no próximo carregamento */ }
  }, []);

  return { items, counts, loading, refresh: fetchAll, markRead, markAllRead, prefs };
}
