'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

interface MetricCardProps {
  title: string;
  value: number | string;
  subtitle: string;
  icon: LucideIcon;
  format?: 'number' | 'currency' | 'percentage';
  highlight?: { bg: string; text?: string };
}

export function MetricCard({ title, value, subtitle, icon: Icon, format = 'number', highlight }: MetricCardProps) {
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
      <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-3">
        <div
          className={highlight ? 'p-2.5 rounded-lg' : 'p-2.5 rounded-lg bg-primary/10'}
          style={highlight ? { backgroundColor: highlight.text ? `${highlight.text}22` : 'rgba(255,255,255,0.15)' } : undefined}
        >
          <Icon
            className={highlight ? 'h-5 w-5' : 'h-5 w-5 text-primary'}
            style={highlight ? { color: highlight.text || '#ffffff' } : undefined}
          />
        </div>
        <div className="flex-1">
          <p
            className={highlight ? 'text-sm' : 'text-sm text-muted-foreground'}
            style={highlight ? { color: highlight.text ? `${highlight.text}bb` : 'rgba(255,255,255,0.7)' } : undefined}
          >
            {title}
          </p>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div
          className={highlight ? 'text-3xl font-bold mb-1' : 'text-3xl font-bold text-foreground mb-1'}
          style={highlight ? { color: highlight.text || '#ffffff' } : undefined}
        >
          {formattedValue()}
        </div>
        <p
          className={highlight ? 'text-xs' : 'text-xs text-muted-foreground'}
          style={highlight ? { color: highlight.text ? `${highlight.text}99` : 'rgba(255,255,255,0.6)' } : undefined}
        >
          {subtitle}
        </p>
      </CardContent>
    </Card>
  );
}
