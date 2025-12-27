'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

interface CustomCalendarProps {
  mode?: 'single' | 'range';
  selected?: Date | DateRange | undefined;
  onSelect?: (date: Date | DateRange | undefined) => void;
  numberOfMonths?: number;
  className?: string;
}

export function CustomCalendar({
  mode = 'single',
  selected,
  onSelect,
  numberOfMonths = 1,
  className,
}: CustomCalendarProps) {
  const [currentMonth, setCurrentMonth] = React.useState(new Date());

  const monthNames = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
  ];

  const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: (Date | null)[] = [];

    // Preencher dias vazios do início
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    // Preencher dias do mês
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }

    return days;
  };

  const isSameDay = (date1: Date | null, date2: Date | null | undefined) => {
    if (!date1 || !date2) return false;
    return (
      date1.getDate() === date2.getDate() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getFullYear() === date2.getFullYear()
    );
  };

  const isInRange = (day: Date | null, range: DateRange | undefined) => {
    if (!day || !range || !range.from || !range.to) return false;
    return day >= range.from && day <= range.to;
  };

  const isToday = (date: Date | null) => {
    if (!date) return false;
    const today = new Date();
    return isSameDay(date, today);
  };

  const handleDayClick = (day: Date | null) => {
    if (!day || !onSelect) return;

    if (mode === 'single') {
      onSelect(day);
    } else if (mode === 'range') {
      const range = selected as DateRange | undefined;

      if (!range || !range.from || range.to) {
        // Começar nova seleção
        onSelect({ from: day, to: undefined });
      } else {
        // Completar range
        if (day < range.from) {
          onSelect({ from: day, to: range.from });
        } else {
          onSelect({ from: range.from, to: day });
        }
      }
    }
  };

  const previousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const renderMonth = (monthOffset: number = 0) => {
    const displayMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + monthOffset);
    const days = getDaysInMonth(displayMonth);

    return (
      <div key={monthOffset} className="min-w-[280px]">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 px-2">
          {monthOffset === 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={previousMonth}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
          {monthOffset !== 0 && <div className="w-8" />}

          <div className="font-medium capitalize">
            {monthNames[displayMonth.getMonth()]} {displayMonth.getFullYear()}
          </div>

          {monthOffset === numberOfMonths - 1 && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={nextMonth}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
          {monthOffset !== numberOfMonths - 1 && <div className="w-8" />}
        </div>

        {/* Day names */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {dayNames.map((name) => (
            <div
              key={name}
              className="h-9 flex items-center justify-center text-xs font-medium text-muted-foreground"
            >
              {name}
            </div>
          ))}
        </div>

        {/* Days */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((day, index) => {
            const isSelected = mode === 'single'
              ? isSameDay(day, selected as Date)
              : false;

            const range = mode === 'range' ? (selected as DateRange) : undefined;
            const isRangeStart = range ? isSameDay(day, range.from) : false;
            const isRangeEnd = range ? isSameDay(day, range.to) : false;
            const isInRangeMiddle = isInRange(day, range) && !isRangeStart && !isRangeEnd;
            const dayIsToday = isToday(day);

            return (
              <button
                key={index}
                onClick={() => handleDayClick(day)}
                disabled={!day}
                className={`
                  h-9 flex items-center justify-center text-sm rounded-md transition-colors
                  ${!day ? 'invisible' : ''}
                  ${day && !isSelected && !isRangeStart && !isRangeEnd && !isInRangeMiddle ? 'hover:bg-accent' : ''}
                  ${isSelected || isRangeStart || isRangeEnd ? 'bg-primary text-primary-foreground hover:bg-primary/90' : ''}
                  ${isInRangeMiddle ? 'bg-accent' : ''}
                  ${dayIsToday && !isSelected && !isRangeStart && !isRangeEnd ? 'bg-accent font-semibold' : ''}
                `}
              >
                {day?.getDate()}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className={`p-4 ${className || ''}`}>
      <div className="flex gap-8">
        {Array.from({ length: numberOfMonths }).map((_, i) => renderMonth(i))}
      </div>
    </div>
  );
}
