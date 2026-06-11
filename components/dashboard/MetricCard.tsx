'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { LucideIcon, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  title: string;
  value: number | string;
  subtitle: string;
  icon: LucideIcon;
  format?: 'number' | 'currency' | 'percentage';
  highlight?: { bg: string; text?: string };
  delta?: number | null;
}

export function MetricCard({ title, value, subtitle, icon: Icon, format = 'number', highlight, delta }: MetricCardProps) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (format === 'number' && typeof value === 'number') {
      const duration = 1000;
      const steps = 60;
      const increment = value / steps;
      let current = 0;
      const timer = setInterval(() => {
        current += increment;
        if (current >= value) { setDisplayValue(value); clearInterval(timer); }
        else { setDisplayValue(Math.floor(current)); }
      }, duration / steps);
      return () => clearInterval(timer);
    } else {
      setDisplayValue(typeof value === 'number' ? value : 0);
    }
  }, [value, format]);

  const formattedValue = () => {
    if (format === 'currency') {
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
        typeof value === 'number' ? value : 0
      );
    }
    if (format === 'percentage') return `${value}%`;
    return displayValue;
  };

  const hasDelta = delta !== undefined && delta !== null;
  const isPositive = hasDelta && delta! > 0;
  const isNegative = hasDelta && delta! < 0;

  return (
    <Card className="border-border hover:shadow-md transition-all" style={highlight ? { background: highlight.bg, borderColor: 'transparent' } : undefined}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2 px-4 pt-4">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 rounded-lg flex-shrink-0" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
            <Icon className="h-4 w-4" style={{ color: hasDelta ? (isPositive ? '#34B270' : isNegative ? '#ef4444' : '#888') : '#888' }} />
          </div>
          <p className="text-xs text-muted-foreground truncate">{title}</p>
        </div>

        {hasDelta && (
          <div className={cn(
            'flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0',
            isPositive ? 'text-emerald-400' : isNegative ? 'text-red-400' : 'text-muted-foreground',
            isPositive ? 'bg-emerald-500/10' : isNegative ? 'bg-red-500/10' : 'bg-muted',
          )}>
            {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {Math.abs(delta!)}%
          </div>
        )}
      </CardHeader>

      <CardContent className="pt-0 px-4 pb-4">
        <div className="text-xl md:text-2xl font-bold text-foreground truncate">
          {formattedValue()}
        </div>
        <p className="text-[10px] md:text-xs text-muted-foreground mt-1">{subtitle}</p>
      </CardContent>
    </Card>
  );
}
