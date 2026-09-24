'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCheck, Loader2, SlidersHorizontal } from 'lucide-react';
import { useNotifications } from '@/lib/hooks/useNotifications';
import { NotifItem, NotifTab, itemsForTab, longDate } from '@/lib/notifications/model';
import { NotifIcon } from '@/components/notifications/NotifIcon';
import { NotificationPreferences } from '@/components/notifications/NotificationPreferences';

const SYS = 'system-ui, sans-serif';

const GHOST: React.CSSProperties = {
  height: 42, padding: '0 18px', borderRadius: 999, background: '#141414', border: '1px solid #262626',
  boxShadow: '0 3px 0 #050505', color: '#fff', fontSize: 14, fontWeight: 500, lineHeight: '18px', display: 'flex', alignItems: 'center', gap: 8,
};

const EMPTY: Record<NotifTab, string> = {
  attention: 'Nada precisa de você agora.',
  message: 'Nenhuma mensagem nova.',
  activity: 'Nenhuma ação sua por aqui ainda.',
  all: 'Tudo em dia.',
};

export default function NotificacoesPage() {
  const router = useRouter();
  const { items, counts, loading, markRead, markAllRead, prefs } = useNotifications();
  const [tab, setTab] = useState<NotifTab | null>(null);
  const [prefsOpen, setPrefsOpen] = useState(false);

  // Abre em "Precisam de você" quando há algo; senão em "Tudo".
  useEffect(() => {
    if (!loading && tab === null) setTab(counts.attention > 0 ? 'attention' : 'all');
  }, [loading, tab, counts.attention]);

  if (loading || tab === null) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Carregando notificações...</span>
        </div>
      </div>
    );
  }

  const list = itemsForTab(items, tab, prefs);
  const anyUnread = items.some((i) => !i.read && i.kind !== 'activity');
  const tabs: { id: NotifTab; label: string; badge?: number }[] = [
    { id: 'attention', label: 'Precisam de você', badge: counts.attention },
    { id: 'message', label: 'Mensagens' },
    { id: 'activity', label: 'Atividade' },
    { id: 'all', label: 'Tudo' },
  ];

  const open = (item: NotifItem) => {
    void markRead(item);
    if (item.href) router.push(item.href);
  };

  return (
    <div className="mx-auto flex max-w-[1040px] flex-col px-2 pb-20" style={{ gap: 28, fontFamily: SYS }}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col" style={{ gap: 6 }}>
          <h1 style={{ margin: 0, color: '#fff', fontSize: 32, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: '40px' }}>Notificações</h1>
          <p style={{ margin: 0, color: '#A3A3A3', fontSize: 16, lineHeight: '20px' }}>
            {counts.attention > 0 ? `${counts.attention} ${counts.attention === 1 ? 'precisa' : 'precisam'} de você` : 'Tudo em dia'}
          </p>
        </div>
        <div className="flex" style={{ gap: 10 }}>
          {anyUnread && (
            <button type="button" onClick={() => void markAllRead()} className="transition-transform active:translate-y-0.5" style={GHOST}>
              <CheckCheck size={16} /> Marcar tudo como lido
            </button>
          )}
          <button type="button" onClick={() => setPrefsOpen(true)} className="transition-transform active:translate-y-0.5" style={GHOST}>
            <SlidersHorizontal size={16} /> Preferências
          </button>
        </div>
      </div>

      <div role="tablist" className="flex flex-wrap self-start" style={{ gap: 6, padding: 6, background: '#101010', border: '1px solid #1C1C1C', borderRadius: 999 }}>
        {tabs.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.id)}
              className="flex items-center transition-colors"
              style={{ gap: 8, height: 38, padding: '0 18px', borderRadius: 999, fontSize: 15, lineHeight: '18px', fontWeight: active ? 600 : 400, background: active ? '#0F3D2B' : 'transparent', color: active ? '#fff' : '#A3A3A3' }}
            >
              {t.label}
              {!!t.badge && (
                <span style={{ background: '#F5A524', color: '#1A1200', borderRadius: 999, padding: '2px 8px', fontSize: 12, fontWeight: 700, lineHeight: '16px' }}>{t.badge}</span>
              )}
            </button>
          );
        })}
      </div>

      {list.length === 0 ? (
        <div style={{ background: '#101010', border: '1px solid #1C1C1C', borderRadius: 20, padding: '64px 28px', textAlign: 'center', color: '#8A8A8A', fontSize: 16 }}>
          {EMPTY[tab]}
        </div>
      ) : (
        <div className="flex flex-col overflow-hidden" style={{ background: '#101010', border: '1px solid #1C1C1C', borderRadius: 20 }}>
          {list.map((item, i) => (
            <div key={item.id} className="flex items-start" style={{ gap: 18, padding: '24px 28px', borderBottom: i < list.length - 1 ? '1px solid #1C1C1C' : 0 }}>
              <NotifIcon item={item} size={44} />
              <div className="flex flex-1 min-w-0 flex-col" style={{ gap: 6 }}>
                <div className="flex items-center" style={{ gap: 10 }}>
                  <div style={{ color: '#fff', fontSize: 17, fontWeight: 600, lineHeight: '22px' }}>{item.title}</div>
                  {!item.read && <div style={{ background: '#96F63C', borderRadius: 4, width: 8, height: 8, flexShrink: 0 }} aria-label="Não lida" />}
                </div>
                {item.body && <div className="line-clamp-3" style={{ color: '#A3A3A3', fontSize: 15, lineHeight: '23px' }}>{item.body}</div>}
                <div className="flex flex-wrap items-center" style={{ gap: 14, marginTop: 8 }}>
                  {item.actionLabel && item.href && (
                    <button
                      type="button"
                      onClick={() => open(item)}
                      className="transition-transform active:translate-y-0.5"
                      style={{ height: 40, padding: '0 20px', borderRadius: 999, background: '#01573C', boxShadow: '0 3px 0 #013825', color: '#fff', fontSize: 14, fontWeight: 600, lineHeight: '18px' }}
                    >
                      {item.actionLabel}
                    </button>
                  )}
                  <span style={{ color: '#737373', fontSize: 14, lineHeight: '18px' }}>{longDate(item.created_at)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <NotificationPreferences open={prefsOpen} onOpenChange={setPrefsOpen} />
    </div>
  );
}
