'use client';

import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar as CalendarIcon } from 'lucide-react';
import { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import { calendarLocale } from '@/lib/calendar-locale';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface DateRangePickerProps {
  date: DateRange | undefined;
  onDateChange: (date: DateRange | undefined) => void;
}

export function DateRangePicker({ date, onDateChange }: DateRangePickerProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'w-full justify-start text-left font-normal h-9',
            !date && 'text-muted-foreground'
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
          <span className="truncate">
            {date?.from ? (
              date.to ? (
                <>
                  {format(date.from, 'dd/MM/yy', { locale: ptBR })} -{' '}
                  {format(date.to, 'dd/MM/yy', { locale: ptBR })}
                </>
              ) : (
                format(date.from, 'dd/MM/yyyy', { locale: ptBR })
              )
            ) : (
              'Selecionar período'
            )}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0 bg-card border shadow-lg"
        align="start"
        sideOffset={4}
      >
        <div className="p-3 border-b bg-muted/50">
          <p className="text-sm font-medium">Selecionar período</p>
        </div>
        <Calendar
          initialFocus
          mode="range"
          defaultMonth={date?.from}
          selected={date}
          onSelect={onDateChange}
          numberOfMonths={2}
          locale={calendarLocale}
        />
      </PopoverContent>
    </Popover>
  );
}
