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

  // SVG arc gauge — half circle (180°)
  const r = 52;
  const cx = 70;
  const cy = 70;
  const strokeWidth = 10;
  const circumference = Math.PI * r; // half circle
  const trackPath = `M ${cx - r},${cy} A ${r},${r} 0 0,1 ${cx + r},${cy}`;
  const fillOffset = circumference * (1 - pct / 100);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-0 flex-shrink-0">
        <CardTitle>Taxa de conversão</CardTitle>
        <CardDescription>{periodo}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col items-center justify-center pb-4 gap-4">
        {/* Gauge */}
        <div className="relative">
          <svg width="140" height="80" viewBox="0 0 140 80">
            {/* Track */}
            <path
              d={trackPath}
              fill="none"
              stroke="hsl(var(--primary) / 0.15)"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
            />
            {/* Fill */}
            <path
              d={trackPath}
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={fillOffset}
              style={{ transition: 'stroke-dashoffset 0.7s ease' }}
            />
          </svg>
          {/* Label */}
          <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
            <span className="text-2xl font-bold text-foreground leading-none">{pct}%</span>
            <span className="text-xs text-muted-foreground mt-0.5">Conversão</span>
          </div>
        </div>

        {/* Delta */}
        {delta !== null && delta !== undefined && (
          <div className={`flex items-center gap-1.5 font-medium text-sm ${delta >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
            {delta >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            {delta >= 0 ? '+' : ''}{delta}% vs período anterior
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center gap-6 text-sm text-foreground">
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-primary inline-block" />
            {fechados} fechados
          </span>
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-primary/20 border border-primary/30 inline-block" />
            {emAndamento} em andamento
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
