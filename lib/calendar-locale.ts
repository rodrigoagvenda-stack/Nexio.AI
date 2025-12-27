import { ptBR } from 'date-fns/locale';
import { Locale } from 'date-fns';

// Customiza o locale para mostrar nomes dos dias corretos
export const calendarLocale: Locale = {
  ...ptBR,
  localize: {
    ...ptBR.localize!,
    day: (dayIndex: number) => {
      const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      return days[dayIndex];
    },
  },
};
