'use client';

import { TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ConversionRadialProps {
  fechados: number;
  emAndamento: number;
  delta?: number | null;
  periodo: string;
}

export function ConversionDonut({ fechados, emAndamento, delta, periodo }: ConversionRadialProps) {
  const total = fechados + emAndamento;
  const pct = total > 0 ? Math.round((fechados / total) * 100) : 0;

  // Semicírculo 180°: dimensões maiores para preencher o card
  const r = 90;
  const cx = 128;
  const cy = 108;
  const strokeW = 14;
  const circ = Math.PI * r;
  const trackPath = `M ${cx - r},${cy} A ${r},${r} 0 0,1 ${cx + r},${cy}`;
  const fillOffset = circ * (1 - pct / 100);

  const hasDelta = delta !== null && delta !== undefined;
  const isPositive = hasDelta && delta! >= 0;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2 flex-shrink-0">
        <CardTitle className="text-base font-semibold">Taxa de conversão</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col pb-5 px-2">
        {/* Gauge + Delta: ocupa o espaço disponível */}
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="relative w-full flex justify-center">
            <svg
              width="100%"
              viewBox={`0 0 ${cx * 2} ${cy + strokeW / 2 + 6}`}
              style={{ maxWidth: 260 }}
              overflow="visible"
            >
              <defs>
                <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#0E5B3F" />
                  <stop offset="100%" stopColor="#34B270" />
                </linearGradient>
              </defs>
              <path d={trackPath} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={strokeW} strokeLinecap="round" />
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
              <text x={cx} y={cy - 4} textAnchor="middle" fontSize="32" fontWeight="700" fill="white">{pct}%</text>
              <text x={cx} y={cy + 16} textAnchor="middle" fontSize="11" fill="#888">Conversão</text>
            </svg>
          </div>

          {hasDelta && (
            <div className={`flex items-center gap-1.5 text-sm font-semibold ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
              {isPositive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
              {isPositive ? '+' : ''}{delta}% vs período anterior
            </div>
          )}
        </div>

        {/* Legenda: rodapé */}
        <div className="flex justify-center gap-6 pt-3 pb-1 border-t border-border/20 mt-1">
          <span className="flex items-center gap-1.5 text-xs" style={{ color: '#888' }}>
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: '#34B270' }} />
            {fechados} fechados
          </span>
          <span className="flex items-center gap-1.5 text-xs" style={{ color: '#888' }}>
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: '#4A4A4A' }} />
            {emAndamento} em andamento
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
