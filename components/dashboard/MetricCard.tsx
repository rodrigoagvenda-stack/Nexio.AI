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
      // Counter animation
      const duration = 1000;
      const steps = 60;
      const increment = value / steps;
      let current = 0;

      const timer = setInterval(() => {
        current += increment;
        if (current >= value) {
          setDisplayValue(value);
          clearInterval(timer);
        } else {
          setDisplayValue(Math.floor(current));
        }
      }, duration / steps);

      return () => clearInterval(timer);
    } else {
      setDisplayValue(typeof value === 'number' ? value : 0);
    }
  }, [value, format]);

  const formattedValue = () => {
    if (format === 'currency') {
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }).format(typeof value === 'number' ? value : 0);
    }
    if (format === 'percentage') {
      return `${value}%`;
    }
    return displayValue;
  };

  return (
    <Card
      className="border-border hover:shadow-md transition-all"
      style={highlight ? { background: highlight.bg, borderColor: 'transparent' } : undefined}
    >
      <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2 px-3 pt-3 md:px-6 md:pt-6">
        <div
          className={highlight ? 'p-2 rounded-lg flex-shrink-0' : 'p-2 rounded-lg bg-primary/10 flex-shrink-0'}
          style={highlight ? { backgroundColor: highlight.text ? `${highlight.text}22` : 'rgba(255,255,255,0.15)' } : undefined}
        >
          <Icon
            className={highlight ? 'h-4 w-4 md:h-5 md:w-5' : 'h-4 w-4 md:h-5 md:w-5 text-primary'}
            style={highlight ? { color: highlight.text || '#ffffff' } : undefined}
          />
        </div>
        <div className="flex-1 min-w-0">
          <p
            className={highlight ? 'text-xs md:text-sm truncate' : 'text-xs md:text-sm text-muted-foreground truncate'}
            style={highlight ? { color: highlight.text ? `${highlight.text}bb` : 'rgba(255,255,255,0.7)' } : undefined}
          >
            {title}
          </p>
        </div>
      </CardHeader>
      <CardContent className="pt-0 px-3 pb-3 md:px-6 md:pb-6">
        <div className="flex items-end justify-between gap-2 mb-0.5">
          <div
            className={highlight ? 'text-lg md:text-2xl font-bold truncate' : 'text-lg md:text-2xl font-bold text-foreground truncate'}
            style={highlight ? { color: highlight.text || '#ffffff' } : undefined}
          >
            {formattedValue()}
          </div>
          {delta !== undefined && delta !== null && (
            <div className={cn(
              'flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 mb-0.5',
              delta > 0 ? 'bg-emerald-500/10 text-emerald-500' : delta < 0 ? 'bg-red-500/10 text-red-500' : 'bg-muted text-muted-foreground'
            )}>
              {delta > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {Math.abs(delta)}%
            </div>
          )}
        </div>
        <p
          className={highlight ? 'text-[10px] md:text-xs' : 'text-[10px] md:text-xs text-muted-foreground'}
          style={highlight ? { color: highlight.text ? `${highlight.text}99` : 'rgba(255,255,255,0.6)' } : undefined}
        >
          {subtitle}
        </p>
      </CardContent>
    </Card>
  );
}
