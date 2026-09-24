'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell } from 'lucide-react';
import { useNotifications } from '@/lib/hooks/useNotifications';
import { NotifItem, NotifTab, itemsForTab, shortDate } from '@/lib/notifications/model';
import { NotifIcon } from './NotifIcon';

const SYS = 'system-ui, sans-serif';
const TABS: { id: NotifTab; label: string }[] = [
  { id: 'all', label: 'Tudo' },
  { id: 'attention', label: 'Precisam de você' },
  { id: 'message', label: 'Mensagens' },
];
const MAX_ROWS = 6;

/** Sino da barra do topo: contador, popover e (única instância) o som e o aviso do navegador. */
export function NotificationBell() {
  const router = useRouter();
  const { items, counts, loading, refresh, markRead, markAllRead, prefs } = useNotifications({ alerts: true });
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<NotifTab>('all');

  const list = itemsForTab(items, tab, prefs).slice(0, MAX_ROWS);
  const anyUnread = items.some((i) => !i.read && i.kind !== 'activity');

  const openItem = (item: NotifItem) => {
    void markRead(item);
    setOpen(false);
    router.push(item.href ?? (item.kind === 'message' ? '/atendimento' : '/notificacoes'));
  };

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={counts.total > 0 ? `Notificações, ${counts.total} novas` : 'Notificações'}
        className="relative h-10 w-10 flex items-center justify-center rounded-full cursor-pointer text-white/70 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
        onClick={() => { setOpen((v) => !v); if (!open) void refresh(); }}
      >
        <Bell className="h-5 w-5" />
        {counts.total > 0 && (
          <span
            className="absolute top-1 right-1 min-w-[16px] h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white px-1"
            style={{ backgroundColor: '#ef4444', lineHeight: 1 }}
          >
            {counts.total > 99 ? '99+' : counts.total}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="fixed z-50 left-4 right-4 top-[84px] sm:left-auto sm:right-4 sm:w-[480px] sm:top-[90px] flex flex-col overflow-hidden"
            style={{ maxHeight: 'calc(100dvh - 100px)', background: '#141414', border: '1px solid #262626', borderRadius: 20, boxShadow: '0 24px 60px #00000099', fontFamily: SYS }}
          >
            <div className="flex items-center justify-between" style={{ padding: '20px 24px 12px' }}>
              <div style={{ color: '#fff', fontSize: 18, fontWeight: 600, lineHeight: '22px' }}>Notificações</div>
              {anyUnread && (
                <button type="button" onClick={() => void markAllRead()} style={{ color: '#96F63C', fontSize: 14, fontWeight: 600, lineHeight: '18px' }}>
                  Marcar tudo como lido
                </button>
              )}
            </div>

            <div className="flex gap-1.5" style={{ padding: '0 20px 16px' }}>
              {TABS.map((t) => {
                const active = tab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    className="flex items-center gap-1.5 transition-colors"
                    style={{ height: 34, padding: '0 14px', borderRadius: 999, fontSize: 14, lineHeight: '18px', fontWeight: active ? 600 : 400, background: active ? '#0F3D2B' : 'transparent', color: active ? '#fff' : '#A3A3A3' }}
                  >
                    {t.label}
                    {t.id === 'attention' && counts.attention > 0 && (
                      <span style={{ background: '#F5A524', color: '#1A1200', borderRadius: 999, padding: '1px 7px', fontSize: 11, fontWeight: 700, lineHeight: '14px' }}>{counts.attention}</span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="overflow-y-auto flex-1" style={{ borderTop: '1px solid #1C1C1C' }}>
              {list.length === 0 ? (
                <div style={{ padding: '40px 24px', textAlign: 'center', color: '#8A8A8A', fontSize: 14 }}>
                  {loading ? 'Carregando…' : 'Tudo em dia. Nada precisa de você agora.'}
                </div>
              ) : (
                list.map((item, i) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => openItem(item)}
                    className="w-full flex items-start text-left hover:bg-white/[0.03] transition-colors"
                    style={{ gap: 14, padding: '16px 24px', borderBottom: i < list.length - 1 ? '1px solid #1C1C1C' : 0 }}
                  >
                    <NotifIcon item={item} />
                    <div className="flex-1 min-w-0 flex flex-col" style={{ gap: 3 }}>
                      <div className="line-clamp-2" style={{ color: '#fff', fontSize: 15, fontWeight: 600, lineHeight: '21px' }}>{item.title}</div>
                      {item.body && <div className="line-clamp-2" style={{ color: '#A3A3A3', fontSize: 14, lineHeight: '20px' }}>{item.body}</div>}
                    </div>
                    <div className="flex flex-col items-end" style={{ gap: 8 }}>
                      <div style={{ color: '#737373', fontSize: 13, lineHeight: '16px' }}>{shortDate(item.created_at)}</div>
                      {!item.read && <div style={{ background: '#96F63C', borderRadius: 4, width: 8, height: 8 }} />}
                    </div>
                  </button>
                ))
              )}
            </div>

            <div className="flex items-center justify-between gap-3" style={{ borderTop: '1px solid #1C1C1C', padding: '16px 24px' }}>
              <button type="button" onClick={() => { setOpen(false); router.push('/notificacoes'); }} style={{ color: '#96F63C', fontSize: 14, fontWeight: 600, lineHeight: '18px' }}>
                Ver todas as notificações
              </button>
              <div style={{ color: '#737373', fontSize: 13, lineHeight: '16px' }}>Suas ações ficam em Atividade</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
