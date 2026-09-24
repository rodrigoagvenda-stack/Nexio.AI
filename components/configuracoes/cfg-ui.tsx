import { cn } from '@/lib/utils';

// Peças de tela repetidas na Configuração, no layout do Paper.

export const CARD = 'rounded-[14px] border border-border bg-card';
export const LIME = 'text-[#01573C] dark:text-[#96F63C]';
export const FIELD = 'h-[50px] w-full rounded-xl border border-border bg-muted px-4 text-[15px] text-foreground placeholder:text-muted-foreground/70 outline-none transition-colors focus:border-primary/60 focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:bg-card disabled:text-muted-foreground';

export function CardTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-[5px]">
      <h2 className="text-[19px] font-semibold leading-6 text-foreground">{title}</h2>
      {hint && <p className="text-sm leading-[1.5] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function FieldLabel({ children, optional, htmlFor }: { children: React.ReactNode; optional?: boolean; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="flex items-baseline gap-2 text-sm font-semibold leading-[18px] text-foreground">
      {children}
      {optional && <span className="text-[13px] font-normal text-muted-foreground">opcional</span>}
    </label>
  );
}

export function StatusPill({ tone, children }: { tone: 'ok' | 'off' | 'warn'; children: React.ReactNode }) {
  return (
    <span className={cn(
      'inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-[5px] text-[13px] font-semibold',
      tone === 'ok' && 'bg-[#01573C]/10 text-[#01573C] dark:bg-[#96F63C]/[0.12] dark:text-[#96F63C]',
      tone === 'off' && 'border border-border bg-muted text-muted-foreground',
      tone === 'warn' && 'bg-red-500/10 text-red-700 dark:text-red-400',
    )}>
      {tone === 'ok' && <span className="h-[7px] w-[7px] rounded-full bg-[#01573C] dark:bg-[#96F63C]" />}
      {children}
    </span>
  );
}
