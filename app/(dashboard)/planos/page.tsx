'use client';

import Link from 'next/link';
import { Check, ArrowRight, Zap } from 'lucide-react';
import { PlanoCards } from '@/components/planos/PlanoCards';

const TRUST_BADGES = [
  'Suporte igual para todos',
  'Sem contrato mínimo',
  'Cancele quando quiser',
  'Setup incluso',
];

export default function PlanosPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-16 py-4 pb-20">

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <div className="text-center space-y-6">
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

        <div className="flex flex-wrap justify-center gap-2">
          {TRUST_BADGES.map(b => (
            <span key={b} className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/60 border border-border/60 px-3 py-1.5 rounded-full">
              <Check className="h-3 w-3 text-primary flex-shrink-0" />
              {b}
            </span>
          ))}
        </div>
      </div>

      {/* ── Cards + tabela completa ──────────────────────────────────────── */}
      <PlanoCards showFull={true} />

      {/* ── Footer ──────────────────────────────────────────────────────── */}
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
