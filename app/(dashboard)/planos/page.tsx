'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, X, ArrowRight, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── CountUp ───────────────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 1000, delay = 0) {
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

const PLANS = [
  {
    key: 'starter',
    name: 'Zaapply Start',
    price: 397,
    tokens: '5M',
    users: '3',
    numbers: '1',
    popular: false,
    ctaLabel: 'Começar com o Start',
    ctaHref: '/configuracoes?tab=plano',
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
    key: 'growth',
    name: 'Zaapply Growth',
    price: 697,
    tokens: '15M',
    users: '10',
    numbers: '1',
    popular: true,
    ctaLabel: 'Crescer com o Growth',
    ctaHref: '/configuracoes?tab=plano',
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
    key: 'scale',
    name: 'Zaapply Pro',
    price: 997,
    tokens: '50M',
    users: 'Ilimitados',
    numbers: 'Até 5',
    popular: false,
    ctaLabel: 'Escalar com o Pro',
    ctaHref: '/configuracoes?tab=plano',
    canvas: 'Tudo do Growth',
    highlights: [
      'Tudo do Growth',
      '50M tokens/mês',
      'Até 5 números WhatsApp',
      'Usuários ilimitados',
    ],
  },
] as const;

const ALL_INCLUDE = [
  'Métricas e relatórios completos',
  'Briefing com IA',
  'Suporte igual para todos',
  'Canvas de automação',
  'CRM Kanban',
  'Atendimento via chat',
];

const TRUST_BADGES = [
  'Suporte igual para todos',
  'Sem contrato mínimo',
  'Cancele quando quiser',
  'Setup incluso',
];

type FeatureVal = boolean | string;

interface Feature {
  label: string;
  group?: string;
  starter: FeatureVal;
  growth: FeatureVal;
  scale: FeatureVal;
}

const FEATURES: Feature[] = [
  // Core
  { label: 'Agente SDR com IA',       group: 'Core',        starter: true,  growth: true,  scale: true },
  { label: 'Atendimento via chat',     group: 'Core',        starter: true,  growth: true,  scale: true },
  { label: 'CRM Kanban',               group: 'Core',        starter: true,  growth: true,  scale: true },
  { label: 'Métricas e relatórios',    group: 'Core',        starter: true,  growth: true,  scale: true },
  { label: 'Briefing com IA',          group: 'Core',        starter: true,  growth: true,  scale: true },
  { label: 'Suporte',                  group: 'Core',        starter: 'Igual', growth: 'Igual', scale: 'Igual' },
  // Canvas
  { label: 'Follow-up automático',     group: 'Canvas',      starter: true,  growth: true,  scale: true },
  { label: 'Anti-Noshow',              group: 'Canvas',      starter: false, growth: true,  scale: true },
  { label: 'Remarketing',              group: 'Canvas',      starter: false, growth: true,  scale: true },
  { label: 'Trial SaaS',               group: 'Canvas',      starter: false, growth: true,  scale: true },
  // Integrações
  { label: 'Google Calendar',          group: 'Integrações', starter: false, growth: true,  scale: true },
  // Escala
  { label: 'Tokens mensais',           group: 'Escala',      starter: '5M',  growth: '15M', scale: '50M' },
  { label: 'Usuários',                 group: 'Escala',      starter: '3',   growth: '10',  scale: 'Ilimitados' },
  { label: 'Números WhatsApp',         group: 'Escala',      starter: '1',   growth: '1',   scale: 'Até 5' },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function FeatureCell({ value, highlight }: { value: FeatureVal; highlight?: boolean }) {
  if (value === true) return <Check className={cn('h-4 w-4 mx-auto', highlight ? 'text-primary-foreground/70' : 'text-primary')} />;
  if (value === false) return <X className="h-3.5 w-3.5 mx-auto text-muted-foreground/20" />;
  return <span className={cn('text-sm font-medium', highlight ? 'text-primary-foreground' : 'text-foreground')}>{value}</span>;
}

function PriceDisplay({ price, delay, isDark }: { price: number; delay: number; isDark: boolean }) {
  const count = useCountUp(price, 900, delay);
  return (
    <div className="flex items-baseline gap-1">
      <span className={cn('text-sm', isDark ? 'text-primary-foreground/50' : 'text-muted-foreground')}>R$</span>
      <span className={cn('text-5xl font-black tracking-tight tabular-nums', isDark ? 'text-primary-foreground' : 'text-foreground')}>
        {count.toLocaleString('pt-BR')}
      </span>
      <span className={cn('text-sm', isDark ? 'text-primary-foreground/50' : 'text-muted-foreground')}>/mês</span>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PlanosPage() {
  const groups = [...new Set(FEATURES.map(f => f.group))];

  return (
    <div className="max-w-5xl mx-auto space-y-16 py-4 pb-20">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div className="text-center space-y-6">
        {/* Brand mark */}
        <div className="flex justify-center">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/25">
              <span className="text-3xl font-black text-primary-foreground leading-none select-none">Z</span>
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-green-400 border-2 border-background flex items-center justify-center">
              <Zap className="h-2.5 w-2.5 text-white" />
            </div>
          </div>
        </div>

        <div>
          <h1 className="text-4xl font-bold tracking-tight">Escolha seu plano</h1>
          <p className="text-muted-foreground mt-3 text-base max-w-sm mx-auto leading-relaxed">
            Pague pelo que você usa. Escale quando precisar.
          </p>
        </div>

        {/* Trust badges */}
        <div className="flex flex-wrap justify-center gap-2">
          {TRUST_BADGES.map(b => (
            <span key={b} className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/60 border border-border/60 px-3 py-1.5 rounded-full">
              <Check className="h-3 w-3 text-primary flex-shrink-0" />
              {b}
            </span>
          ))}
        </div>
      </div>

      {/* ── Cards ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 items-start">
        {PLANS.map((plan, idx) => {
          const isDark = plan.popular;
          return (
            <div
              key={plan.key}
              className={cn(
                'relative rounded-2xl p-7 flex flex-col gap-6 transition-all',
                isDark
                  ? 'bg-foreground text-primary-foreground ring-1 ring-foreground shadow-xl shadow-foreground/10'
                  : 'bg-card border border-border hover:border-border/60',
                plan.popular && '-mt-2 sm:-my-2'
              )}
            >
              {isDark && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-primary text-primary-foreground shadow-sm whitespace-nowrap">
                    Mais popular
                  </span>
                </div>
              )}

              {/* Plan name */}
              <p className={cn('text-[11px] font-bold uppercase tracking-widest', isDark ? 'text-primary-foreground/40' : 'text-muted-foreground')}>
                {plan.name}
              </p>

              {/* Price com CountUp */}
              <PriceDisplay price={plan.price} delay={idx * 120} isDark={isDark} />

              {/* Canvas highlight */}
              <div className={cn(
                'rounded-xl px-3.5 py-2.5 text-xs leading-snug',
                isDark ? 'bg-white/8 text-primary-foreground/80' : 'bg-primary/6 text-primary border border-primary/15'
              )}>
                <span className="font-semibold">Canvas:</span> {plan.canvas}
              </div>

              {/* CTA */}
              <Link
                href={plan.ctaHref}
                className={cn(
                  'flex items-center justify-center gap-1.5 w-full h-11 rounded-xl text-sm font-semibold transition-all',
                  isDark
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                    : 'border border-border hover:bg-muted/50 text-foreground'
                )}
              >
                {plan.ctaLabel}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>

              {/* Highlights */}
              <ul className="space-y-2.5">
                {plan.highlights.map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <Check className={cn('h-3.5 w-3.5 mt-0.5 shrink-0', isDark ? 'text-primary' : 'text-primary')} />
                    <span className={cn('text-sm leading-snug', isDark ? 'text-primary-foreground/75' : 'text-muted-foreground')}>
                      {item}
                    </span>
                  </li>
                ))}
              </ul>

              {/* Scale footer */}
              <div className={cn('pt-4 border-t text-xs space-y-1', isDark ? 'border-white/10 text-primary-foreground/40' : 'border-border text-muted-foreground/60')}>
                <p>{plan.tokens} tokens/mês</p>
                <p>{plan.users} usuários · {plan.numbers} número{plan.numbers !== '1' ? 's' : ''} WhatsApp</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Todos os planos incluem ────────────────────────────────────────── */}
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
          Métricas, briefing e suporte com a mesma qualidade em todos os planos.
          Você paga mais para fazer mais — não para ser tratado melhor.
        </p>
      </div>

      {/* ── Tabela de comparação ───────────────────────────────────────────── */}
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
                    p.popular ? 'bg-foreground text-primary-foreground' : 'text-foreground'
                  )}>
                    {p.name.replace('Zaapply ', '')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map(group => (
                <>
                  <tr key={`group-${group}`} className="border-b border-border/40">
                    <td colSpan={4} className="px-6 py-2 bg-muted/30">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">{group}</span>
                    </td>
                  </tr>
                  {FEATURES.filter(f => f.group === group).map((feature, i) => (
                    <tr key={feature.label} className={cn(
                      'border-b border-border/40 last:border-0',
                      i % 2 !== 0 ? 'bg-muted/10' : ''
                    )}>
                      <td className="px-6 py-3.5 text-muted-foreground">{feature.label}</td>
                      <td className="px-5 py-3.5 text-center"><FeatureCell value={feature.starter} /></td>
                      <td className="px-5 py-3.5 text-center bg-foreground/[0.03]"><FeatureCell value={feature.growth} /></td>
                      <td className="px-5 py-3.5 text-center"><FeatureCell value={feature.scale} /></td>
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <div className="text-center space-y-3">
        <p className="text-sm text-muted-foreground">Dúvida sobre qual plano faz mais sentido pro seu negócio?</p>
        <Link
          href="https://wa.me/5511999999999"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline underline-offset-2"
        >
          Falar com o time <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
