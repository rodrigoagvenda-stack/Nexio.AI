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

  const getCardStyle = () => {
    // Diferentes cores para cada tipo de métrica
    if (title.includes('Novos')) return 'bg-gradient-to-br from-blue-500 to-blue-600';
    if (title.includes('Atendimento')) return 'bg-gradient-to-br from-purple-500 to-purple-600';
    if (title.includes('Conversão')) return 'bg-gradient-to-br from-green-500 to-green-600';
    if (title.includes('Faturamento')) return 'bg-gradient-to-br from-orange-500 to-orange-600';
    return 'bg-gradient-to-br from-primary to-orange-600';
  };

  return (
    <Card className={`transition-all duration-300 hover:shadow-xl hover:scale-105 ${getCardStyle()} text-white border-0`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="p-3 rounded-2xl bg-white/20 backdrop-blur-sm">
          <Icon className="h-6 w-6" />
        </div>
        {format === 'percentage' && (
          <span className="text-xs px-3 py-1.5 rounded-full bg-white/20 backdrop-blur-sm font-semibold">
            +{value}%
          </span>
        )}
      </CardHeader>
      <CardContent>
        <div className="text-sm font-medium opacity-90 mb-1">{title}</div>
        <div className="text-4xl font-bold tracking-tight mb-1">{formattedValue()}</div>
        <p className="text-xs opacity-80">{subtitle}</p>
      </CardContent>
    </Card>
  );
}
