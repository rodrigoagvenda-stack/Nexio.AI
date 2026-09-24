import { AlertCircle, Clock, CreditCard, Hand, PlugZap, Zap } from 'lucide-react';
import type { NotifItem, NotifIconName } from '@/lib/notifications/model';

const ICONS = { hand: Hand, clock: Clock, alert: AlertCircle, card: CreditCard, plug: PlugZap, bolt: Zap } as const;

const TONES: Record<'amber' | 'red' | 'neutral', { bg: string; fg: string }> = {
  amber: { bg: '#2A2410', fg: '#E9C46A' },
  red: { bg: '#2B1414', fg: '#F87171' },
  neutral: { bg: '#1E1E1E', fg: '#D4D4D4' },
};

/** Círculo à esquerda da notificação: ícone amarelo (precisa de você), vermelho (problema), iniciais ou foto (mensagem). */
export function NotifIcon({ item, size = 40 }: { item: NotifItem; size?: number }) {
  const box: React.CSSProperties = {
    width: size, height: size, borderRadius: size / 2, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  };

  if (item.kind === 'message') {
    return (
      <div style={{ ...box, background: TONES.neutral.bg, color: TONES.neutral.fg, fontFamily: 'system-ui, sans-serif', fontSize: size >= 44 ? 15 : 14, fontWeight: 600 }}>
        {item.photo ? <img src={item.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : item.initials}
      </div>
    );
  }

  const name: NotifIconName = item.icon;
  const Icon = ICONS[name];
  const tone = name === 'alert' ? TONES.red : item.kind === 'activity' ? TONES.neutral : TONES.amber;
  return (
    <div style={{ ...box, background: tone.bg }}>
      <Icon size={size >= 44 ? 22 : 20} color={tone.fg} strokeWidth={2.2} />
    </div>
  );
}
