/**
 * Folga mínima pra oferecer horário de reunião. Decisão do Rodrigo em 2026-09-21: pode oferecer o horário de HOJE se
 * couber no expediente com folga de no mínimo 1 hora. Antes, a instrução do agendamento proibia "o mesmo dia" e o SDR
 * só oferecia o próximo dia útil. Função pura (testável sem calendário).
 */
export const MIN_NOTICE_MINUTES = 60

/** O horário começa antes de agora + folga mínima (inclui horários que já passaram). */
export function isTooSoon(start: Date, nowMs: number, minMinutes: number = MIN_NOTICE_MINUTES): boolean {
  return start.getTime() < nowMs + minMinutes * 60_000
}
