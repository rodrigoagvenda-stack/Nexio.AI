'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';

export const AUTOMATION_TABS = [
  { id: 'geral', label: 'Visão geral', href: '/automacoes' },
  { id: 'sequencias', label: 'Sequências', href: '/configuracoes/follow' },
  { id: 'sdr', label: 'SDR', href: '/configuracoes/sdr' },
  { id: 'outbound', label: 'Outbound', href: '/outbound' },
  { id: 'calendario', label: 'Calendário', href: '/configuracoes/agenda' },
  { id: 'metricas', label: 'Métricas', href: '/configuracoes/metricas' },
] as const;

export type AutomationTab = (typeof AUTOMATION_TABS)[number]['id'];

/** Abas da área de Automações: cada uma leva à sua tela. */
export function AutomationsNav({ active, className }: { active: AutomationTab; className?: string }) {
  return (
    <nav aria-label="Automações" className={cn('flex w-fit max-w-full items-center gap-0.5 overflow-x-auto rounded-full bg-muted p-1', className)}>
      {AUTOMATION_TABS.map((t) => (
        <Link
          key={t.id}
          href={t.href}
          aria-current={active === t.id ? 'page' : undefined}
          className={cn('shrink-0 rounded-full px-5 py-2 text-sm transition-colors', active === t.id ? 'bg-[#0F3D2B] font-semibold text-white' : 'font-medium text-muted-foreground hover:text-foreground')}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
