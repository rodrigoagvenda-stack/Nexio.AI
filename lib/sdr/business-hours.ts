import { createServiceClient } from '@/lib/supabase/server'

type Supabase = ReturnType<typeof createServiceClient>

// Sem horário configurado (nenhuma linha em business_hours) = sempre aberto,
// pra não quebrar empresas que nunca mexeram na aba Horários.
export async function isWithinBusinessHours(companyId: number, supabase: Supabase): Promise<boolean> {
  const { data: rows } = await supabase
    .from('business_hours')
    .select('day_of_week, open_time, close_time, closed')
    .eq('company_id', companyId)
    .is('wa_number_id', null)

  if (!rows || rows.length === 0) return true

  const spNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
  const dayOfWeek = spNow.getDay() // 0=domingo..6=sábado, mesma convenção da coluna
  const hhmm = spNow.toTimeString().slice(0, 5)

  const today = rows.find((r) => r.day_of_week === dayOfWeek)
  if (!today || today.closed || !today.open_time || !today.close_time) return false

  return hhmm >= today.open_time.slice(0, 5) && hhmm < today.close_time.slice(0, 5)
}
