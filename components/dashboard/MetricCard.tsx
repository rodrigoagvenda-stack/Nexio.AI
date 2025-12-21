'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

interface MetricCardProps {
  title: string;
  value: number | string;
  subtitle: string;
  icon: LucideIcon;
  format?: 'number' | 'currency' | 'percentage';
}

export function MetricCard({ title, value, subtitle, icon: Icon, format = 'number' }: MetricCardProps) {
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
    <Card className="transition-all duration-300 hover:shadow-lg hover:scale-105 border-l-4 border-l-primary">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-full bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        </div>
        {format === 'percentage' && (
          <span className="text-xs px-2 py-1 rounded-full bg-green-500/10 text-green-600 font-medium">
            +{value}%
          </span>
        )}
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold tracking-tight">{formattedValue()}</div>
        <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
      </CardContent>
    </Card>
  );
}
