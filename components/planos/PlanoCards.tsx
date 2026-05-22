'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, X, Minus, Plus, ArrowRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── CountUp ───────────────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 900, delay = 0) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => {
      const start = performance.now();
      const tick = (now: number) => {
        const p = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 4);
        setValue(Math.round(eased * target));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, delay);
    return () => clearTimeout(t);
  }, [target, duration, delay]);
  return value;
}

// ── Data ──────────────────────────────────────────────────────────────────────

export const PLAN_KEYS = ['starter', 'pro', 'scale'] as const;
export type PlanKey = typeof PLAN_KEYS[number];

const PLANS = [
  {
    key: 'starter' as PlanKey,
    name: 'Zaapply Start',
    basePrice: 397,
    tokens: '5M',
    users: '3',
    numbers: '1',
    popular: false,
    canvas: 'Follow-up automático',
    highlights: [
      'Agente SDR com IA',
      'Atendimento via chat',
      'CRM Kanban',
      'Canvas → Follow-up automático',
      '5M tokens/mês',
      '1 número WhatsApp · 3 usuários',
    ],
  },
  {
    key: 'pro' as PlanKey,
    name: 'Zaapply Growth',
    basePrice: 697,
    tokens: '15M',
    users: '10',
    numbers: '1',
    popular: true,
    canvas: 'Follow-up · Anti-Noshow · Remarketing · Trial SaaS',
    highlights: [
      'Tudo do Start',
      'Canvas → Anti-Noshow, Remarketing, Trial SaaS',
      'Google Calendar integrado',
      '15M tokens/mês',
      '1 número WhatsApp · 10 usuários',
    ],
  },
  {
    key: 'scale' as PlanKey,
    name: 'Zaapply Pro',
    basePrice: 997,
    tokens: '50M',
    users: 'Ilimitados',
    numbers: 'Até 5',
    popular: false,
    canvas: 'Tudo do Growth',
    highlights: [
      'Tudo do Growth',
      '50M tokens/mês',
      'Até 5 números WhatsApp',
      'Usuários ilimitados',
    ],
  },
];

type FeatureVal = boolean | string;
interface Feature { label: string; group: string; starter: FeatureVal; growth: FeatureVal; scale: FeatureVal }

const FEATURES: Feature[] = [
  { label: 'Agente SDR com IA',     group: 'Core',        starter: true,    growth: true,    scale: true },
  { label: 'Atendimento via chat',  group: 'Core',        starter: true,    growth: true,    scale: true },
  { label: 'CRM Kanban',            group: 'Core',        starter: true,    growth: true,    scale: true },
  { label: 'Métricas e relatórios', group: 'Core',        starter: true,    growth: true,    scale: true },
  { label: 'Briefing com IA',       group: 'Core',        starter: true,    growth: true,    scale: true },
  { label: 'Suporte',               group: 'Core',        starter: 'Igual', growth: 'Igual', scale: 'Igual' },
  { label: 'Follow-up automático',  group: 'Canvas',      starter: true,    growth: true,    scale: true },
  { label: 'Anti-Noshow',           group: 'Canvas',      starter: false,   growth: true,    scale: true },
  { label: 'Remarketing',           group: 'Canvas',      starter: false,   growth: true,    scale: true },
  { label: 'Trial SaaS',            group: 'Canvas',      starter: false,   growth: true,    scale: true },
  { label: 'Google Calendar',       group: 'Integrações', starter: false,   growth: true,    scale: true },
  { label: 'Tokens mensais',        group: 'Escala',      starter: '5M',    growth: '15M',   scale: '50M' },
  { label: 'Usuários',              group: 'Escala',      starter: '3',     growth: '10',    scale: 'Ilimitados' },
  { label: 'Números WhatsApp',      group: 'Escala',      starter: '1',     growth: '1',     scale: 'Até 5' },
];

const ALL_INCLUDE = [
  'Métricas e relatórios completos',
  'Briefing com IA',
  'Suporte igual para todos',
  'Canvas de automação',
  'CRM Kanban',
  'Atendimento via chat',
];

// ── Props ─────────────────────────────────────────────────────────────────────

interface PlanoCardsProps {
  /** Modo checkout: botão chama onSelect com o plano e número de extras */
  onSelect?: (plan: PlanKey, extraNumbers: number) => void;
  currentPlan?: string;
  loadingPlan?: string;
  /** Mostra tabela completa e bloco "todos incluem" */
  showFull?: boolean;
}

// ── FeatureCell ───────────────────────────────────────────────────────────────

function FeatureCell({ value }: { value: FeatureVal }) {
  if (value === true) return <Check className="h-4 w-4 mx-auto text-primary" />;
  if (value === false) return <X className="h-3.5 w-3.5 mx-auto text-muted-foreground/20" />;
  return <span className="text-sm font-medium text-foreground">{value}</span>;
}

// ── Single card (isolates useCountUp call) ────────────────────────────────────

interface CardProps {
  plan: typeof PLANS[number];
  extraNumbers: number;
  delay: number;
  isCurrent: boolean;
  isLoading: boolean;
  onSelect?: (key: PlanKey, extra: number) => void;
}

function PlanCard({ plan, extraNumbers, delay, isCurrent, isLoading, onSelect }: CardProps) {
  const totalPrice = plan.basePrice + extraNumbers * 97;
  const count = useCountUp(totalPrice, 900, delay);

  return (
    <div className={cn(
      'relative rounded-2xl flex flex-col transition-all',
      plan.popular
        ? 'bg-primary text-primary-foreground ring-2 ring-primary shadow-xl shadow-primary/20'
        : isCurrent
        ? 'bg-card border-2 border-primary'
        : 'bg-card border border-border hover:border-border/60'
    )}>
      {/* Badge */}
      {(plan.popular || isCurrent) && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
          <span className={cn(
            'px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest whitespace-nowrap shadow-sm',
            plan.popular ? 'bg-primary-foreground text-primary' : 'bg-primary text-primary-foreground'
          )}>
            {isCurrent ? 'Plano atual' : 'Mais popular'}
          </span>
        </div>
      )}

      <div className="p-7 flex flex-col gap-5 flex-1">
        <p className={cn('text-[11px] font-bold uppercase tracking-widest', plan.popular ? 'text-primary-foreground/50' : 'text-muted-foreground')}>
          {plan.name}
        </p>

        {/* Price */}
        <div>
          <div className="flex items-baseline gap-1">
            <span className={cn('text-sm', plan.popular ? 'text-primary-foreground/50' : 'text-muted-foreground')}>R$</span>
            <span className={cn('text-5xl font-black tracking-tight tabular-nums', plan.popular ? 'text-primary-foreground' : 'text-foreground')}>
              {count.toLocaleString('pt-BR')}
            </span>
            <span className={cn('text-sm', plan.popular ? 'text-primary-foreground/50' : 'text-muted-foreground')}>/mês</span>
          </div>
          {extraNumbers > 0 && (
            <p className={cn('text-xs mt-0.5', plan.popular ? 'text-primary-foreground/40' : 'text-muted-foreground/60')}>
              R$ {plan.basePrice} + {extraNumbers}× R$ 97
            </p>
          )}
        </div>

        {/* Canvas highlight */}
        <div className={cn(
          'rounded-xl px-3.5 py-2.5 text-xs leading-snug',
          plan.popular ? 'bg-primary-foreground/10 text-primary-foreground/80' : 'bg-primary/6 text-primary border border-primary/15'
        )}>
          <span className="font-semibold">Canvas:</span> {plan.canvas}
        </div>

        {/* CTA */}
        {onSelect ? (
          <button
            disabled={isCurrent || isLoading}
            onClick={() => !isCurrent && onSelect(plan.key, extraNumbers)}
            className={cn(
              'flex items-center justify-center gap-1.5 w-full h-11 rounded-xl text-sm font-semibold transition-all',
              plan.popular
                ? 'bg-primary-foreground text-primary hover:bg-primary-foreground/90'
                : isCurrent
                ? 'border border-primary/30 text-primary/60 cursor-default'
                : 'bg-primary text-primary-foreground hover:bg-primary/90'
            )}
          >
            {isLoading ? <><Loader2 className="h-4 w-4 animate-spin" />Aguarde…</> : isCurrent ? 'Plano atual' : 'Escolher plano'}
          </button>
        ) : (
          <Link
            href="/configuracoes?tab=plano"
            className={cn(
              'flex items-center justify-center gap-1.5 w-full h-11 rounded-xl text-sm font-semibold transition-all',
              plan.popular
                ? 'bg-primary-foreground text-primary hover:bg-primary-foreground/90'
                : 'border border-border hover:bg-muted/50 text-foreground'
            )}
          >
            {plan.popular ? 'Crescer com o Growth' : plan.key === 'starter' ? 'Começar com o Start' : 'Escalar com o Pro'}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}

        {/* Highlights */}
        <ul className="space-y-2.5 flex-1">
          {plan.highlights.map(item => (
            <li key={item} className="flex items-start gap-2.5">
              <Check className={cn('h-3.5 w-3.5 mt-0.5 shrink-0', plan.popular ? 'text-primary-foreground/60' : 'text-primary')} />
              <span className={cn('text-sm leading-snug', plan.popular ? 'text-primary-foreground/75' : 'text-muted-foreground')}>{item}</span>
            </li>
          ))}
        </ul>

        {/* Footer */}
        <div className={cn('pt-4 border-t text-xs space-y-1', plan.popular ? 'border-primary-foreground/10 text-primary-foreground/35' : 'border-border text-muted-foreground/50')}>
          <p>{plan.tokens} tokens/mês</p>
          <p>{plan.users} usuários · {plan.numbers} número{plan.numbers !== '1' ? 's' : ''} WhatsApp</p>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function PlanoCards({ onSelect, currentPlan, loadingPlan, showFull = false }: PlanoCardsProps) {
  const [extraNumbers, setExtraNumbers] = useState(0);
  const groups = [...new Set(FEATURES.map(f => f.group))];

  return (
    <div className="space-y-10">

      {/* ── Número adicional ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 px-5 py-4 rounded-xl border border-dashed border-border bg-muted/20">
        <div>
          <p className="text-sm font-medium">Número adicional de WhatsApp</p>
          <p className="text-xs text-muted-foreground mt-0.5">R$ 97/mês por número extra</p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <button onClick={() => setExtraNumbers(n => Math.max(0, n - 1))} className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors">
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="w-6 text-center text-sm font-semibold tabular-nums">{extraNumbers}</span>
            <button onClick={() => setExtraNumbers(n => Math.min(9, n + 1))} className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors">
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="text-right min-w-[90px]">
            {extraNumbers > 0
              ? <><p className="font-semibold text-sm">+R$ {extraNumbers * 97}<span className="text-xs font-normal text-muted-foreground">/mês</span></p><p className="text-xs text-muted-foreground">+{extraNumbers} número{extraNumbers > 1 ? 's' : ''}</p></>
              : <p className="text-xs text-muted-foreground">Nenhum extra</p>
            }
          </div>
        </div>
      </div>

      {/* ── Cards ──────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 items-stretch">
        {PLANS.map((plan, idx) => (
          <PlanCard
            key={plan.key}
            plan={plan}
            extraNumbers={extraNumbers}
            delay={idx * 100}
            isCurrent={currentPlan === plan.key}
            isLoading={loadingPlan === plan.key}
            onSelect={onSelect}
          />
        ))}
      </div>

      {!showFull && (
        <p className="text-center text-xs text-muted-foreground">
          Métricas, briefing e suporte com a mesma qualidade em todos os planos.{' '}
          <span className="text-foreground/60">Você paga mais para fazer mais — não para ser tratado melhor.</span>
        </p>
      )}

      {/* ── Seções extras (apenas na página /planos) ────────────────────────── */}
      {showFull && (
        <>
          {/* Todos incluem */}
          <div className="rounded-2xl border border-border bg-card p-8">
            <p className="text-sm font-semibold text-center mb-6">Todos os planos incluem</p>
            <div className="grid sm:grid-cols-3 gap-4">
              {ALL_INCLUDE.map(item => (
                <div key={item} className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Check className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <span className="text-sm text-muted-foreground">{item}</span>
                </div>
              ))}
            </div>
            <p className="text-center text-xs text-muted-foreground/60 mt-6 leading-relaxed">
              Você paga mais para fazer mais — não para ser tratado melhor.
            </p>
          </div>

          {/* Tabela */}
          <div className="rounded-2xl border border-border overflow-hidden bg-card">
            <div className="px-6 py-5 border-b border-border">
              <h2 className="text-sm font-semibold">Comparação completa</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-6 py-4 text-muted-foreground font-medium w-1/2">Recurso</th>
                    {PLANS.map(p => (
                      <th key={p.key} className={cn(
                        'text-center px-5 py-4 font-bold text-xs uppercase tracking-widest',
                        p.popular ? 'bg-primary text-primary-foreground' : 'text-foreground'
                      )}>
                        {p.name.replace('Zaapply ', '')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {groups.map(group => (
                    <>
                      <tr key={`g-${group}`} className="border-b border-border/40">
                        <td colSpan={4} className="px-6 py-2 bg-muted/30">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">{group}</span>
                        </td>
                      </tr>
                      {FEATURES.filter(f => f.group === group).map((feat, i) => (
                        <tr key={feat.label} className={cn('border-b border-border/40 last:border-0', i % 2 !== 0 ? 'bg-muted/10' : '')}>
                          <td className="px-6 py-3.5 text-muted-foreground">{feat.label}</td>
                          <td className="px-5 py-3.5 text-center"><FeatureCell value={feat.starter} /></td>
                          <td className="px-5 py-3.5 text-center bg-primary/[0.03]"><FeatureCell value={feat.growth} /></td>
                          <td className="px-5 py-3.5 text-center"><FeatureCell value={feat.scale} /></td>
                        </tr>
                      ))}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
