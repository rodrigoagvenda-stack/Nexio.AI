'use client';

import { Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';

interface DateFilterProps {
  selectedPeriod: 'today' | 'week' | 'month' | 'year' | 'custom';
  onPeriodChange: (period: 'today' | 'week' | 'month' | 'year' | 'custom') => void;
  dateRange?: DateRange;
  onDateRangeChange?: (range: DateRange | undefined) => void;
}

export function DateFilter({
  selectedPeriod,
  onPeriodChange,
  dateRange,
  onDateRangeChange,
}: DateFilterProps) {
  return (
    <div className="flex items-center gap-2">
      <Button
        variant={selectedPeriod === 'today' ? 'default' : 'outline'}
        size="sm"
        onClick={() => onPeriodChange('today')}
        className="rounded-full px-4"
      >
        Hoje
      </Button>
      <Button
        variant={selectedPeriod === 'week' ? 'default' : 'outline'}
        size="sm"
        onClick={() => onPeriodChange('week')}
        className="rounded-full px-4"
      >
        Semana
      </Button>
      <Button
        variant={selectedPeriod === 'month' ? 'default' : 'outline'}
        size="sm"
        onClick={() => onPeriodChange('month')}
        className="rounded-full px-4"
      >
        Mês
      </Button>
      <Button
        variant={selectedPeriod === 'year' ? 'default' : 'outline'}
        size="sm"
        onClick={() => onPeriodChange('year')}
        className="rounded-full px-4"
      >
        Ano
      </Button>

      {/* Custom Calendar */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant={selectedPeriod === 'custom' ? 'default' : 'outline'}
            size="sm"
            className={cn(
              'rounded-full px-4',
              selectedPeriod === 'custom' && 'gap-2'
            )}
          >
            <Calendar className="h-4 w-4" />
            {selectedPeriod === 'custom' && dateRange?.from && (
              <span className="text-xs">
                {format(dateRange.from, 'dd/MM', { locale: ptBR })}
                {dateRange.to && ` - ${format(dateRange.to, 'dd/MM', { locale: ptBR })}`}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <CalendarComponent
            mode="range"
            selected={dateRange}
            onSelect={(range) => {
              onDateRangeChange?.(range);
              if (range?.from) {
                onPeriodChange('custom');
              }
            }}
            numberOfMonths={2}
            locale={ptBR}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
