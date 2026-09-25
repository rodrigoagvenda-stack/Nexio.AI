'use client';

import { cn } from '@/lib/utils';

export const CARD = 'rounded-[14px] border border-border bg-card';
export const LIME = 'text-[#01573C] dark:text-[#96F63C]';
export const PILL3D = 'flex h-11 items-center justify-center gap-2 rounded-full bg-[#141414] px-6 text-[15px] font-semibold text-white shadow-[inset_0_1px_0_#FFFFFF14,0_3px_0_#000000] transition-transform active:translate-y-px disabled:opacity-60';
export const PILL_GREEN = 'flex h-11 items-center justify-center gap-2 rounded-full bg-[#01573C] px-6 text-[15px] font-semibold text-white shadow-[inset_0_1px_0_#FFFFFF26,0_3px_0_#003526] transition-transform active:translate-y-px disabled:opacity-60';
export const INPUT = 'w-full rounded-xl border border-border bg-muted px-4 py-3 text-[15px] text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-[#01573C]/50 dark:border-[#2A2A2A] dark:bg-[#181818] dark:focus:border-[#96F63C]/40';

export function Toggle({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={cn('flex h-[26px] w-[46px] shrink-0 items-center rounded-full px-[3px] transition-colors disabled:opacity-60', on ? 'justify-end bg-[#01573C]' : 'justify-start bg-muted-foreground/30 dark:bg-[#2A2A2A]')}
    >
      <span className="h-5 w-5 rounded-full bg-white shadow" />
    </button>
  );
}

/** Abas de segundo nível (as mesmas do Outbound): pílulas dentro de um cartão. */
export function SubNav<T extends string>({ items, active, onChange, label, className }: { items: readonly (readonly [T, string])[]; active: T; onChange: (id: T) => void; label: string; className?: string }) {
  return (
    <nav aria-label={label} className={cn('flex w-fit max-w-full items-center gap-0.5 overflow-x-auto rounded-full border border-border bg-card p-1', className)}>
      {items.map(([id, text]) => (
        <button
          key={id}
          type="button"
          aria-current={active === id ? 'page' : undefined}
          onClick={() => onChange(id)}
          className={cn('shrink-0 rounded-full px-5 py-2 text-sm transition-colors', active === id ? 'bg-[#0F3D2B] font-semibold text-white' : 'font-medium text-muted-foreground hover:text-foreground')}
        >
          {text}
        </button>
      ))}
    </nav>
  );
}

/** Chips de filtro do segundo nível (Perguntas, Preço...). */
export function Chips<T extends string>({ items, active, onChange, label }: { items: readonly (readonly [T, string])[]; active: T; onChange: (id: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="flex flex-wrap items-center gap-2">
      {items.map(([id, text]) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={active === id}
          onClick={() => onChange(id)}
          className={cn('rounded-full px-4 py-2 text-sm transition-colors', active === id ? 'bg-[#0F3D2B] font-semibold text-white' : 'bg-muted text-muted-foreground hover:text-foreground')}
        >
          {text}
        </button>
      ))}
    </div>
  );
}
