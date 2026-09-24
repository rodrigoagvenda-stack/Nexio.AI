'use client';

import { useEffect, useState } from 'react';
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

let summaryCache: string | null = null;

/** "5 sequências · 4 ligadas": o resumo que aparece no título de todas as telas de Automações. */
function useSummary() {
  const [summary, setSummary] = useState<string | null>(summaryCache);
  useEffect(() => {
    if (summaryCache) return;
    let cancelled = false;
    fetch('/api/automacoes/overview')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d || cancelled) return;
        const t = d.sequences.total;
        summaryCache = `${t} ${t === 1 ? 'sequência' : 'sequências'} · ${d.sequences.active} ${d.sequences.active === 1 ? 'ligada' : 'ligadas'}`;
        setSummary(summaryCache);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);
  return summary;
}

/** Título "Automações" (com o resumo) e as abas da área: cada aba leva à sua tela. */
export function AutomationsNav({ active, title = true, className }: { active: AutomationTab; title?: boolean; className?: string }) {
  const summary = useSummary();
  return (
    <div className={cn('flex flex-col gap-6', className)}>
      {title && (
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[26px] font-semibold leading-8 tracking-tight text-foreground">Automações</h1>
          <p className="text-[15px] text-muted-foreground">{summary ?? 'Sequências, SDR, Outbound e calendário no mesmo lugar'}</p>
        </div>
      )}
      <nav aria-label="Automações" className="flex w-fit max-w-full items-center gap-0.5 overflow-x-auto rounded-full bg-muted p-1">
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
    </div>
  );
}
