'use client';

import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { CustomCalendar } from '@/components/ui/custom-calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

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
            'w-full justify-start text-left font-normal',
            !date?.from && 'text-muted-foreground'
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
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
            <span>Selecionar período</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <CustomCalendar
          mode="range"
          selected={date}
          onSelect={(value) => onDateChange(value as DateRange)}
          numberOfMonths={2}
        />
      </PopoverContent>
    </Popover>
  );
}
