'use client';

// Thin wrappers that make lucide-animated icons compatible with { className?: string } interface.
// Each wrapper passes size={16} so the SVG dimensions match Tailwind's h-4/w-4 (16px).

import { TrendingUpIcon } from '@/components/ui/trending-up';
import { MessageCircleIcon } from '@/components/ui/message-circle';
import { BotIcon } from '@/components/ui/bot';
import { SettingsIcon } from '@/components/ui/settings';
import { SparklesIcon } from '@/components/ui/sparkles';
import { BrainIcon } from '@/components/ui/brain';
import { ZapIcon } from '@/components/ui/zap';
import { MessageSquareIcon } from '@/components/ui/message-square';
import { SendIcon } from '@/components/ui/send';
import { RefreshCWIcon } from '@/components/ui/refresh-cw';
import { ActivityIcon } from '@/components/ui/activity';

type IconProps = { className?: string };
const wrap = (size: number) =>
  (Component: React.ComponentType<{ size?: number; className?: string }>) =>
    ({ className }: IconProps) => <Component size={size} className={className} />;

const s16 = wrap(16);
const s20 = wrap(20);

// ── Size-16 (sidebar nav, tab headers) ───────────────────────────────────────
export const AnimTrendingUp    = s16(TrendingUpIcon);
export const AnimMessageCircle = s16(MessageCircleIcon);
export const AnimBot           = s16(BotIcon);
export const AnimSettings      = s16(SettingsIcon);
export const AnimSparkles      = s16(SparklesIcon);
export const AnimBrain         = s16(BrainIcon);
export const AnimZap           = s16(ZapIcon);
export const AnimMessageSquare = s16(MessageSquareIcon);
export const AnimSend          = s16(SendIcon);
export const AnimRefreshCW     = s16(RefreshCWIcon);
export const AnimActivity      = s16(ActivityIcon);

// ── Size-20 (SDR hero/status sections) ───────────────────────────────────────
export const AnimBot20      = s20(BotIcon);
export const AnimSettings20 = s20(SettingsIcon);
export const AnimBrain20    = s20(BrainIcon);
export const AnimZap20      = s20(ZapIcon);
