'use client';

import { TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface ConversionRadialProps {
  fechados: number;
  emAndamento: number;
  delta?: number | null;
  periodo: string;
}

export function ConversionDonut({ fechados, emAndamento, delta, periodo }: ConversionRadialProps) {
  const total = fechados + emAndamento;
  const pct = total > 0 ? Math.round((fechados / total) * 100) : 0;

  // Semicírculo estilo velocímetro: arco de 180° (da esquerda para a direita passando por cima)
  const r = 56;
  const cx = 80;
  const cy = 72;
  const strokeW = 11;
  const circ = Math.PI * r;
  const trackPath = `M ${cx - r},${cy} A ${r},${r} 0 0,1 ${cx + r},${cy}`;
  const fillOffset = circ * (1 - pct / 100);

  const hasDelta = delta !== null && delta !== undefined;
  const isPositive = hasDelta && delta! >= 0;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-0 flex-shrink-0">
        <CardTitle className="text-base">Taxa de conversão</CardTitle>
        <CardDescription className="text-xs">{periodo}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col items-center justify-center pb-5 gap-4">
        {/* Gauge */}
        <div className="relative" style={{ width: 160, height: 92 }}>
          <svg width="160" height="92" viewBox={`0 0 ${cx * 2} ${cy + strokeW / 2 + 4}`}>
            {/* Track */}
            <path d={trackPath} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={strokeW} strokeLinecap="round" />
            {/* Fill — gradiente verde escuro → lime */}
            <defs>
              <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#0E5B3F" />
                <stop offset="100%" stopColor="#34B270" />
              </linearGradient>
            </defs>
            <path
              d={trackPath}
              fill="none"
              stroke="url(#gaugeGrad)"
              strokeWidth={strokeW}
              strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={fillOffset}
              style={{ transition: 'stroke-dashoffset 0.7s ease' }}
            />
          </svg>
          {/* Label centralizado dentro do arco */}
          <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
            <span className="text-3xl font-bold text-foreground leading-none">{pct}%</span>
            <span className="text-xs text-muted-foreground mt-1">Conversão</span>
          </div>
        </div>

        {/* Delta */}
        {hasDelta && (
          <div className={`flex items-center gap-1.5 text-sm font-semibold ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
            {isPositive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
            {isPositive ? '+' : ''}{delta}% vs período anterior
          </div>
        )}

        {/* Legenda com valores reais */}
        <div className="flex items-center gap-5 text-sm">
          <span className="flex items-center gap-2 text-foreground">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: '#34B270' }} />
            {fechados} fechados
          </span>
          <span className="flex items-center gap-2 text-muted-foreground">
            <span className="w-2.5 h-2.5 rounded-full border flex-shrink-0" style={{ borderColor: 'rgba(52,178,112,0.4)', backgroundColor: 'rgba(52,178,112,0.12)' }} />
            {emAndamento} em andamento
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
