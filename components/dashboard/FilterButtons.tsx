'use client';

export type FilterPeriod = 'today' | 'week' | 'month' | 'year' | 'custom';

interface FilterButtonsProps {
  selectedPeriod: FilterPeriod;
  onPeriodChange: (period: FilterPeriod) => void;
}

const FILTERS: { label: string; value: FilterPeriod }[] = [
  { label: 'Hoje',         value: 'today' },
  { label: 'Semana',       value: 'week' },
  { label: 'Mês',          value: 'month' },
  { label: 'Ano',          value: 'year' },
  { label: 'Personalizado', value: 'custom' },
];

export function FilterButtons({ selectedPeriod, onPeriodChange }: FilterButtonsProps) {
  return (
    <div className="flex items-center rounded-full p-1" style={{ backgroundColor: '#141414' }}>
      {FILTERS.map((f) => (
        <button
          key={f.value}
          onClick={() => onPeriodChange(f.value)}
          className="px-4 py-1.5 text-xs font-medium rounded-full transition-all duration-150 whitespace-nowrap"
          style={
            selectedPeriod === f.value
              ? { backgroundColor: '#0F3D2B', color: '#fff', fontWeight: 600 }
              : { color: '#888', background: 'transparent' }
          }
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}
