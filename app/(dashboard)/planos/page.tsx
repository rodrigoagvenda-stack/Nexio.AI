'use client';

import Link from 'next/link';
import { Check, X, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Data ─────────────────────────────────────────────────────────────────────

const PLANS = [
  {
    key: 'starter',
    name: 'Zaapply Start',
    price: 397,
    tokens: '5M',
    popular: false,
    ctaLabel: 'Assinar Start',
    ctaHref: '/configuracoes?tab=plano',
    highlights: [
      'Agente SDR com IA',
      'Follow-up automático',
      'Anti-Noshow',
      'Até 3 usuários',
      'Integrações Google',
    ],
  },
  {
    key: 'pro',
    name: 'Zaapply Growth',
    price: 597,
    tokens: '15M',
    popular: true,
    ctaLabel: 'Assinar Growth',
    ctaHref: '/configuracoes?tab=plano',
    highlights: [
      'Tudo do Start',
      'Remarketing + Trial SaaS',
      'Métricas avançadas',
      'Briefing personalizado',
      'Suporte prioritário',
    ],
  },
  {
    key: 'scale',
    name: 'Zaapply Pro',
    price: 997,
    tokens: '50M',
    popular: false,
    ctaLabel: 'Assinar Pro',
    ctaHref: '/configuracoes?tab=plano',
    highlights: [
      'Tudo do Growth',
      '50M tokens/mês',
      'Usuários ilimitados',
      'Suporte dedicado',
    ],
  },
] as const;

type PlanKey = (typeof PLANS)[number]['key'];

type FeatureValue = boolean | string;

interface Feature {
  label: string;
  starter: FeatureValue;
  pro: FeatureValue;
  scale: FeatureValue;
}

const FEATURES: Feature[] = [
  { label: 'Agente SDR com IA',       starter: true,          pro: true,          scale: true },
  { label: 'Follow-up automático',    starter: true,          pro: true,          scale: true },
  { label: 'Anti-Noshow',             starter: true,          pro: true,          scale: true },
  { label: 'Remarketing',             starter: false,         pro: true,          scale: true },
  { label: 'Trial SaaS',              starter: false,         pro: true,          scale: true },
  { label: 'Métricas avançadas',      starter: false,         pro: true,          scale: true },
  { label: 'Briefing personalizado',  starter: false,         pro: true,          scale: true },
  { label: 'Tokens mensais',          starter: '5M',          pro: '15M',         scale: '50M' },
  { label: 'Usuários',                starter: '3',           pro: '10',          scale: 'Ilimitado' },
  { label: 'Suporte',                 starter: 'Email',       pro: 'Prioritário', scale: 'Dedicado' },
  { label: 'Integrações Google',      starter: true,          pro: true,          scale: true },
];

// ─── Sub-components ────────────────────────────────────────────────────────────

function FeatureCell({ value, dark }: { value: FeatureValue; dark?: boolean }) {
  if (value === true) {
    return (
      <Check
        className={cn('h-4 w-4 mx-auto', dark ? 'text-background/80' : 'text-primary')}
      />
    );
  }
  if (value === false) {
    return (
      <X
        className={cn(
          'h-4 w-4 mx-auto',
          dark ? 'text-background/20' : 'text-muted-foreground/25',
        )}
      />
    );
  }
  return (
    <span
      className={cn(
        'text-sm font-medium',
        dark ? 'text-background' : 'text-foreground',
      )}
    >
      {value}
    </span>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function PlanosPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-14 py-4 pb-16">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="text-center space-y-3">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Escolha seu plano
        </h1>
        <p className="text-muted-foreground text-sm max-w-sm mx-auto">
          Cancele quando quiser. Sem taxas escondidas.
        </p>
      </div>

      {/* ── Plan cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {PLANS.map((plan) => {
          const isDark = plan.popular;
          return (
            <div
              key={plan.key}
              className={cn(
                'relative rounded-2xl p-7 flex flex-col gap-6',
                isDark
                  ? 'bg-foreground text-background'
                  : 'bg-card border border-border',
              )}
            >
              {/* Popular badge */}
              {isDark && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-primary text-primary-foreground shadow-sm">
                    Mais popular
                  </span>
                </div>
              )}

              {/* Plan name */}
              <p
                className={cn(
                  'text-xs font-semibold uppercase tracking-widest',
                  isDark ? 'text-background/50' : 'text-muted-foreground',
                )}
              >
                {plan.name}
              </p>

              {/* Price */}
              <div>
                <div className="flex items-baseline gap-1">
                  <span
                    className={cn(
                      'text-xs',
                      isDark ? 'text-background/60' : 'text-muted-foreground',
                    )}
                  >
                    R$
                  </span>
                  <span
                    className={cn(
                      'text-4xl font-bold tracking-tight',
                      isDark ? 'text-background' : 'text-foreground',
                    )}
                  >
                    {plan.price.toLocaleString('pt-BR')}
                  </span>
                  <span
                    className={cn(
                      'text-xs',
                      isDark ? 'text-background/60' : 'text-muted-foreground',
                    )}
                  >
                    /mês
                  </span>
                </div>
                <p
                  className={cn(
                    'text-xs mt-1',
                    isDark ? 'text-background/50' : 'text-muted-foreground',
                  )}
                >
                  {plan.tokens} tokens/mês
                </p>
              </div>

              {/* CTA */}
              <Link
                href={plan.ctaHref}
                className={cn(
                  'flex items-center justify-center gap-1.5 w-full h-10 rounded-xl text-sm font-semibold transition-all',
                  isDark
                    ? 'bg-background text-foreground hover:bg-background/90'
                    : 'border border-border hover:bg-muted/50 text-foreground',
                )}
              >
                {plan.ctaLabel}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>

              {/* Highlights */}
              <ul className="space-y-2.5">
                {plan.highlights.map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <Check
                      className={cn(
                        'h-4 w-4 mt-0.5 shrink-0',
                        isDark ? 'text-background/70' : 'text-primary',
                      )}
                    />
                    <span
                      className={cn(
                        'text-sm',
                        isDark ? 'text-background/80' : 'text-muted-foreground',
                      )}
                    >
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {/* ── Comparison table ────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border overflow-hidden bg-card">
        {/* Table header label */}
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Comparação completa de recursos</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-6 py-3.5 text-muted-foreground font-medium w-1/2">
                  Recurso
                </th>
                {PLANS.map((p) => (
                  <th
                    key={p.key}
                    className={cn(
                      'text-center px-5 py-3.5 font-semibold text-xs uppercase tracking-wide',
                      p.popular
                        ? 'bg-foreground text-background'
                        : 'text-foreground',
                    )}
                  >
                    {p.name.replace('Zaapply ', '')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FEATURES.map((feature, i) => (
                <tr
                  key={feature.label}
                  className={cn(
                    'border-b border-border/50 last:border-0',
                    i % 2 !== 0 ? 'bg-muted/20' : '',
                  )}
                >
                  <td className="px-6 py-3.5 text-muted-foreground">
                    {feature.label}
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <FeatureCell value={feature.starter} />
                  </td>
                  <td className="px-5 py-3.5 text-center bg-foreground/5">
                    <FeatureCell value={feature.pro} dark={false} />
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <FeatureCell value={feature.scale} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Footer CTA ──────────────────────────────────────────────────────── */}
      <div className="text-center space-y-2">
        <p className="text-sm text-muted-foreground">
          Precisa de ajuda para escolher? Fale com o nosso time.
        </p>
        <Link
          href="https://wa.me/5511999999999"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline underline-offset-2"
        >
          Falar com vendas
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
