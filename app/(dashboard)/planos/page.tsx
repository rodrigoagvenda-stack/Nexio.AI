'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Check, X, Zap, TrendingUp, Rocket, Sparkles, ChevronRight, ArrowRight } from 'lucide-react';
import Link from 'next/link';

const PLANS = [
  {
    key: 'basic',
    name: 'Zaapply Free',
    price: 0,
    tokens: '—',
    tokenRaw: 0,
    icon: Zap,
    desc: 'Para testar e explorar a plataforma.',
    color: 'text-muted-foreground',
    border: 'border-border',
    badge: null,
    ctaLabel: 'Plano atual',
    ctaHref: '#',
    ctaVariant: 'ghost' as const,
  },
  {
    key: 'starter',
    name: 'Zaapply Start',
    price: 397,
    tokens: '5M',
    tokenRaw: 5_000_000,
    icon: TrendingUp,
    desc: 'Para quem quer vender mais sem contratar mais.',
    color: 'text-blue-500',
    border: 'border-border',
    badge: null,
    ctaLabel: 'Assinar Start',
    ctaHref: '/configuracoes?tab=plano',
    ctaVariant: 'outline' as const,
  },
  {
    key: 'pro',
    name: 'Zaapply Growth',
    price: 597,
    tokens: '15M',
    tokenRaw: 15_000_000,
    icon: Rocket,
    desc: 'Para times que não podem perder nenhuma oportunidade.',
    color: 'text-primary',
    border: 'border-primary/60',
    badge: 'Mais popular',
    ctaLabel: 'Assinar Growth',
    ctaHref: '/configuracoes?tab=plano',
    ctaVariant: 'primary' as const,
  },
  {
    key: 'scale',
    name: 'Zaapply Pro',
    price: 997,
    tokens: '50M',
    tokenRaw: 50_000_000,
    icon: Sparkles,
    desc: 'Para operações que vendem em escala.',
    color: 'text-violet-500',
    border: 'border-border',
    badge: null,
    ctaLabel: 'Assinar Pro',
    ctaHref: '/configuracoes?tab=plano',
    ctaVariant: 'outline' as const,
  },
] as const;

type FeatureValue = boolean | string;

interface Feature {
  label: string;
  basic: FeatureValue;
  starter: FeatureValue;
  pro: FeatureValue;
  scale: FeatureValue;
}

const FEATURES: Feature[] = [
  { label: 'CRM (Kanban + Planilha)',      basic: true,       starter: true,       pro: true,           scale: true },
  { label: 'Atendimento WhatsApp',          basic: true,       starter: true,       pro: true,           scale: true },
  { label: 'Agente SDR com IA',             basic: false,      starter: true,       pro: true,           scale: true },
  { label: 'Follow-up automático',          basic: false,      starter: true,       pro: true,           scale: true },
  { label: 'Anti-Noshow',                   basic: false,      starter: true,       pro: true,           scale: true },
  { label: 'Remarketing',                   basic: false,      starter: false,      pro: true,           scale: true },
  { label: 'Trial SaaS',                    basic: false,      starter: false,      pro: true,           scale: true },
  { label: 'Métricas avançadas',            basic: false,      starter: false,      pro: true,           scale: true },
  { label: 'Tokens mensais',                basic: '—',        starter: '5M',       pro: '15M',          scale: '50M' },
  { label: 'Usuários (membros)',             basic: '1',        starter: '3',        pro: '10',           scale: 'Ilimitado' },
  { label: 'Suporte',                       basic: 'Email',    starter: 'Email',    pro: 'Prioritário',  scale: 'Dedicado' },
  { label: 'Briefing personalizado',        basic: false,      starter: false,      pro: true,           scale: true },
  { label: 'Integrações (Google, etc.)',    basic: false,      starter: true,       pro: true,           scale: true },
];

function FeatureCell({ value }: { value: FeatureValue }) {
  if (value === true) return <Check className="h-4 w-4 text-primary mx-auto" />;
  if (value === false) return <X className="h-4 w-4 text-muted-foreground/30 mx-auto" />;
  return <span className="text-sm text-foreground font-medium">{value}</span>;
}

export default function PlanosPage() {
  const [billing] = useState<'monthly'>('monthly');

  return (
    <div className="max-w-6xl mx-auto space-y-12 py-2">

      {/* Header */}
      <div className="text-center space-y-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">Planos & Preços</p>
        <h1 className="text-3xl font-bold text-foreground tracking-tight">
          Escolha o plano certo para o seu time
        </h1>
        <p className="text-muted-foreground max-w-lg mx-auto text-sm">
          Automação de vendas com IA — do primeiro contato ao fechamento. Cancele quando quiser.
        </p>
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {PLANS.map((plan) => {
          const Icon = plan.icon;
          const isPopular = plan.badge === 'Mais popular';
          return (
            <div
              key={plan.key}
              className={cn(
                'relative rounded-2xl border bg-card p-5 flex flex-col gap-4 transition-shadow hover:shadow-lg',
                isPopular
                  ? 'border-primary/60 shadow-md shadow-primary/10 ring-1 ring-primary/20'
                  : plan.border
              )}
            >
              {isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-primary text-primary-foreground shadow">
                    {plan.badge}
                  </span>
                </div>
              )}

              {/* Icon + name */}
              <div className="space-y-2">
                <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center', isPopular ? 'bg-primary/15' : 'bg-muted')}>
                  <Icon className={cn('h-4.5 w-4.5', plan.color)} style={{ width: 18, height: 18 }} />
                </div>
                <p className="font-bold text-foreground">{plan.name}</p>
                <p className="text-xs text-muted-foreground leading-snug">{plan.desc}</p>
              </div>

              {/* Price */}
              <div>
                {plan.price === 0 ? (
                  <p className="text-2xl font-bold text-foreground">Grátis</p>
                ) : (
                  <div className="flex items-baseline gap-1">
                    <span className="text-xs text-muted-foreground">R$</span>
                    <span className="text-2xl font-bold text-foreground">{plan.price.toLocaleString('pt-BR')}</span>
                    <span className="text-xs text-muted-foreground">/mês</span>
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-0.5">{plan.tokens} tokens/mês</p>
              </div>

              {/* CTA */}
              {plan.ctaVariant === 'primary' ? (
                <Link
                  href={plan.ctaHref}
                  className="flex items-center justify-center gap-1.5 w-full h-9 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
                >
                  {plan.ctaLabel}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              ) : plan.ctaVariant === 'outline' ? (
                <Link
                  href={plan.ctaHref}
                  className="flex items-center justify-center gap-1.5 w-full h-9 rounded-xl border border-border text-sm font-semibold hover:bg-accent/50 transition-colors"
                >
                  {plan.ctaLabel}
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              ) : (
                <span className="flex items-center justify-center w-full h-9 rounded-xl text-sm text-muted-foreground bg-muted cursor-default">
                  {plan.ctaLabel}
                </span>
              )}

              {/* Top features teaser */}
              <ul className="space-y-1.5 text-xs text-muted-foreground">
                {plan.key === 'basic' && (
                  <>
                    <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-primary flex-shrink-0" /> CRM e Atendimento</li>
                    <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-primary flex-shrink-0" /> 1 usuário</li>
                  </>
                )}
                {plan.key === 'starter' && (
                  <>
                    <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-primary flex-shrink-0" /> Agente SDR + Follow-up</li>
                    <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-primary flex-shrink-0" /> Anti-Noshow</li>
                    <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-primary flex-shrink-0" /> Até 3 usuários</li>
                  </>
                )}
                {plan.key === 'pro' && (
                  <>
                    <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-primary flex-shrink-0" /> Tudo do Start</li>
                    <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-primary flex-shrink-0" /> Remarketing + Trial SaaS</li>
                    <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-primary flex-shrink-0" /> Métricas + Briefing</li>
                    <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-primary flex-shrink-0" /> Até 10 usuários</li>
                  </>
                )}
                {plan.key === 'scale' && (
                  <>
                    <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-primary flex-shrink-0" /> Tudo do Growth</li>
                    <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-primary flex-shrink-0" /> 50M tokens/mês</li>
                    <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-primary flex-shrink-0" /> Usuários ilimitados</li>
                    <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-primary flex-shrink-0" /> Suporte dedicado</li>
                  </>
                )}
              </ul>
            </div>
          );
        })}
      </div>

      {/* Comparison table */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="px-6 py-4 border-b border-border bg-muted/30">
          <h2 className="font-semibold text-foreground">Comparação completa</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-6 py-3 font-medium text-muted-foreground w-1/2">Recurso</th>
                {PLANS.map(p => (
                  <th key={p.key} className={cn('text-center px-4 py-3 font-semibold', p.key === 'pro' ? 'text-primary' : 'text-foreground')}>
                    {p.name.replace('Zaapply ', '')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FEATURES.map((feature, i) => (
                <tr key={feature.label} className={cn('border-b border-border/50 last:border-0', i % 2 === 0 ? '' : 'bg-muted/20')}>
                  <td className="px-6 py-3 text-muted-foreground">{feature.label}</td>
                  <td className="px-4 py-3 text-center"><FeatureCell value={feature.basic} /></td>
                  <td className="px-4 py-3 text-center"><FeatureCell value={feature.starter} /></td>
                  <td className={cn('px-4 py-3 text-center', 'bg-primary/5')}><FeatureCell value={feature.pro} /></td>
                  <td className="px-4 py-3 text-center"><FeatureCell value={feature.scale} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* FAQ / CTA footer */}
      <div className="text-center space-y-2 py-4">
        <p className="text-sm text-muted-foreground">Dúvidas? Fale com o nosso time.</p>
        <Link
          href="https://wa.me/5511999999999"
          target="_blank"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
        >
          Falar com vendas
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
