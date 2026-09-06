import { createServiceClient } from '@/lib/supabase/server'

type Supabase = ReturnType<typeof createServiceClient>

// Sem horário configurado (nenhuma linha em business_hours) = sempre aberto,
// pra não quebrar empresas que nunca mexeram na aba Horários.
export async function isWithinBusinessHours(companyId: number, supabase: Supabase): Promise<boolean> {
  // Achado ao vivo (Rodrigo, 2026-09-06) : tentei bloquear fim de semana e
  // feriado AQUI (na resposta de chat), mas isso é errado -- "24h" é o SDR
  // RESPONDER (conversar, qualificar) todo santo dia, sem exceção nenhuma,
  // inclusive sábado/domingo/feriado. O que nunca pode acontecer em fim de
  // semana/feriado é MARCAR reunião de verdade na agenda : essa regra fica
  // só em checkAvailableSlots (lib/google-calendar.ts), não aqui. Corrigido
  // de volta, sem restrição de dia nesta função.
  //
  // Achado ao vivo (Rodrigo, 2026-09-04) : apagar a config de Horários pra
  // forçar 24h destrói o trabalho de configurar dias/horários específicos.
  // O correto é um botão dedicado : ligado, ignora business_hours por
  // completo (24h de verdade, todo dia) sem perder a configuração normal
  // por baixo pra quando for desligado de novo.
  const { data: cfg24h } = await supabase
    .from('sdr_configs')
    .select('horario_24h_ativo')
    .eq('company_id', companyId)
    .maybeSingle()
  if (cfg24h?.horario_24h_ativo) return true

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

const DAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

// Texto humano derivado da MESMA tabela que bloqueia mensagens (business_hours),
// pra nunca divergir do que a IA fala do que o gate realmente faz.
// Sem linhas configuradas = '' (fallback pro texto padrão de cada chamador).
export async function getBusinessHoursSummary(companyId: number, supabase: Supabase): Promise<string> {
  const { data: rows } = await supabase
    .from('business_hours')
    .select('day_of_week, open_time, close_time, closed')
    .eq('company_id', companyId)
    .is('wa_number_id', null)
    .order('day_of_week')

  if (!rows || rows.length === 0) return ''

  const sigOf = (r: { closed: boolean; open_time: string | null; close_time: string | null }) =>
    r.closed ? 'fechado' : `${r.open_time?.slice(0, 5)} às ${r.close_time?.slice(0, 5)}`

  const groups: { days: string[]; sig: string }[] = []
  for (let i = 0; i < 7; i++) {
    const row = rows.find((r) => r.day_of_week === i)
    if (!row) continue
    const sig = sigOf(row)
    const last = groups[groups.length - 1]
    if (last && last.sig === sig) last.days.push(DAY_NAMES[i])
    else groups.push({ days: [DAY_NAMES[i]], sig })
  }

  return groups
    .map((g) => {
      const label = g.days.length > 2 ? `${g.days[0]} a ${g.days[g.days.length - 1]}` : g.days.join(' e ')
      return g.sig === 'fechado' ? `${label} fechado` : `${label} das ${g.sig}`
    })
    .join(', ')
}
