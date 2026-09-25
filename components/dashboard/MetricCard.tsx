'use client';

import { LucideIcon, Info } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: number | string;
  subtitle: string;
  icon: LucideIcon;
  format?: 'number' | 'currency' | 'percentage';
  tooltip?: string;
}

export function MetricCard({ title, value, subtitle, icon: Icon, format = 'number', tooltip }: MetricCardProps) {
  const shown =
    format === 'currency'
      ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(typeof value === 'number' ? value : 0)
      : format === 'percentage'
        ? `${value}%`
        : typeof value === 'number' ? value.toLocaleString('pt-BR') : value;

  return (
    <div className="flex flex-col gap-3 rounded-[14px] border border-border bg-card px-6 py-5">
      <div className="flex items-center gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#01573C]/10 dark:bg-[#96F63C]/[0.12]">
          <Icon className="h-4 w-4 text-[#01573C] dark:text-[#96F63C]" />
        </span>
        <p className="truncate text-sm text-muted-foreground">{title}</p>
        {tooltip && <span title={tooltip} className="shrink-0 cursor-help"><Info className="h-3.5 w-3.5 text-muted-foreground/60" /></span>}
      </div>
      <p className="truncate text-[32px] font-semibold leading-10 tracking-tight text-foreground">{shown}</p>
      <p className="text-[13px] text-muted-foreground">{subtitle}</p>
    </div>
  );
}
