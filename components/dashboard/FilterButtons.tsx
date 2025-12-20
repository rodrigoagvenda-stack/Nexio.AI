'use client';

import { Button } from '@/components/ui/button';
import { Calendar } from 'lucide-react';

export type FilterPeriod = 'today' | 'week' | 'month' | 'year' | 'custom';

interface FilterButtonsProps {
  selectedPeriod: FilterPeriod;
  onPeriodChange: (period: FilterPeriod) => void;
}

export function FilterButtons({ selectedPeriod, onPeriodChange }: FilterButtonsProps) {
  const filters: { label: string; value: FilterPeriod }[] = [
    { label: 'Hoje', value: 'today' },
    { label: 'Semana', value: 'week' },
    { label: 'Mês', value: 'month' },
    { label: 'Ano', value: 'year' },
    { label: 'Custom', value: 'custom' },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {filters.map((filter) => (
        <Button
          key={filter.value}
          variant={selectedPeriod === filter.value ? 'default' : 'outline'}
          size="sm"
          onClick={() => onPeriodChange(filter.value)}
          className="transition-all duration-200"
        >
          {filter.value === 'custom' && <Calendar className="mr-2 h-4 w-4" />}
          {filter.label}
        </Button>
      ))}
    </div>
  );
}
