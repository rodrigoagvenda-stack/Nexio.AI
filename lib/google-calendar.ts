/**
 * Google Calendar integration : cria eventos com Meet para agendamento de calls.
 * Suporta OAuth2 por empresa (google_integrations) e service account fallback.
 *
 * googleapis é importado dinamicamente (lazy) para não inflar o bundle de startup (~190 MB).
 */

import type { calendar_v3 } from 'googleapis'
import { createServiceClient } from '@/lib/supabase/server'
import { getPlatformConfig } from '@/lib/platform-config'

const TZ = 'America/Sao_Paulo'

/**
 * Converte string "YYYY-MM-DDTHH:MM:SS" (sem timezone) para Date no fuso Brasil.
 * Usa Intl para determinar offset correto incluindo horário de verão (UTC-3/-2).
 */
export function parseBrazilDateTime(naive: string): Date {
  const clean = naive.replace(/Z$/, '').split('.')[0]
  const [datePart, timePart = '00:00:00'] = clean.split('T')
  const [y, mo, d] = datePart.split('-').map(Number)
  const [h, mi, s = 0] = timePart.split(':').map(Number)
  for (const offsetH of [3, 2]) {
    const utc = new Date(Date.UTC(y, mo - 1, d, h + offsetH, mi, s))
    const localH = parseInt(
      new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', hour12: false }).format(utc)
    )
    if (localH === h) return utc
  }
  return new Date(Date.UTC(y, mo - 1, d, h + 3, mi, s))
}

/** Retorna cliente Calendar usando OAuth tokens da empresa */
async function getCalendarClientForCompany(companyId: number) {
  const { google } = await import('googleapis')
  const service = createServiceClient();
  const { data: integration } = await service
    .from('google_integrations')
    .select('access_token, refresh_token, expires_at')
    .eq('company_id', companyId)
    .single();

  if (!integration?.refresh_token) {
    throw new Error('Google Calendar não conectado para esta empresa');
  }

  const cfg = await getPlatformConfig();
  const clientId = cfg.google_client_id || process.env.GOOGLE_CLIENT_ID!;
  const clientSecret = cfg.google_client_secret || process.env.GOOGLE_CLIENT_SECRET!;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    `${appUrl}/api/google/callback`
  );

  oauth2Client.setCredentials({
    access_token: integration.access_token,
    refresh_token: integration.refresh_token,
    expiry_date: integration.expires_at ? new Date(integration.expires_at).getTime() : undefined,
  });

  // Auto-refresh se expirado
  oauth2Client.on('tokens', async (tokens) => {
    await service.from('google_integrations').update({
      access_token: tokens.access_token,
      expires_at: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
    }).eq('company_id', companyId);
  });

  return google.calendar({ version: 'v3', auth: oauth2Client });
}

export interface CalendarSlot {
  start: Date
  end: Date
  available: boolean
}

export interface ScheduledEvent {
  eventId: string
  meetUrl: string
  start: Date
  end: Date
  title: string
}

export interface CheckSlotsParams {
  calendarId: string
  companyId: number
  date: Date
  durationMinutes?: number
}

export interface CreateEventParams {
  calendarId: string
  companyId: number
  title: string
  description?: string
  start: Date
  durationMinutes?: number
  attendeeEmail?: string
  attendeeName?: string
}

// ─── Feriados nacionais (Brasil) ─────────────────────────────────
//
// Achado ao vivo (2026-09-04) : SDR ofereceu segunda-feira 07/09, feriado
// da Independência, porque nada verificava feriado nenhum — só bloqueava
// dia com evento manual no Google Calendar ou dia marcado fechado no
// horário semanal recorrente. Feriado muda de data (móveis) e ninguém
// lembra de bloquear a agenda toda vez : calcula automaticamente, sem
// depender de ação manual.
function easterSunday(year: number): Date {
  // Algoritmo de Meeus/Jones/Butcher (Gregoriano), padrão pra calcular a Páscoa
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(Date.UTC(year, month - 1, day))
}

// Fixos (MM-DD) : nacionais oficiais + os observados universalmente no
// comércio, mesmo quando "ponto facultativo" técnico (ninguém agenda reunião
// comercial nesses dias na prática).
const FIXED_HOLIDAYS_MD = new Set([
  '01-01', // Confraternização Universal
  '04-21', // Tiradentes
  '05-01', // Dia do Trabalho
  '09-07', // Independência do Brasil
  '10-12', // Nossa Senhora Aparecida
  '11-02', // Finados
  '11-15', // Proclamação da República
  '11-20', // Consciência Negra
  '12-25', // Natal
])

export function isBrazilNationalHoliday(dateStr: string): boolean {
  const year = Number(dateStr.slice(0, 4))
  if (FIXED_HOLIDAYS_MD.has(dateStr.slice(5))) return true

  const easter = easterSunday(year)
  const dayMs = 86_400_000
  const movable = [
    new Date(easter.getTime() - 48 * dayMs), // Carnaval : segunda
    new Date(easter.getTime() - 47 * dayMs), // Carnaval : terça
    new Date(easter.getTime() - 2 * dayMs),  // Sexta-feira Santa
    new Date(easter.getTime() + 60 * dayMs), // Corpus Christi
  ].map((d) => d.toISOString().slice(0, 10))

  return movable.includes(dateStr)
}

/**
 * Verifica slots disponíveis em um dia, fuso America/Sao_Paulo.
 *
 * Janela do dia vem de `business_hours` (mesma tabela que já controla se o
 * SDR responde mensagem fora do horário, lib/sdr/business-hours.ts) : achado
 * ao vivo (2026-09-04) que essa função nunca lia essa tabela, ficava sempre
 * hardcoded Seg-Sex 9h-18h mesmo que a empresa configurasse outro horário —
 * config órfã. Sem linha configurada (wa_number_id null) pro dia = mantém o
 * fallback 9h-18h de sempre, pra nunca quebrar empresa que nunca mexeu nisso.
 * Também bloqueia feriado nacional automaticamente (ver isBrazilNationalHoliday
 * acima). Dia fechado/feriado = retorna lista vazia, que o chamador (Consultar_gcal
 * em engine.ts) já converte corretamente em "Sem horários disponíveis nesta
 * data", nunca em "dia livre".
 */
export async function checkAvailableSlots(
  params: CheckSlotsParams
): Promise<CalendarSlot[]> {
  const { calendarId, companyId, date, durationMinutes = 60 } = params
  const calendar = await getCalendarClientForCompany(companyId)

  const dateStr = date.toISOString().slice(0, 10)

  let openTime = '09:00'
  let closeTime = '18:00'
  let diaFechado = isBrazilNationalHoliday(dateStr)
  // Meio-dia fixo (-03:00) só pra achar o dia da semana certo, sem risco de
  // virada de dia por causa de fuso : não precisa do DST-aware
  // parseBrazilDateTime aqui, é só pra pegar o weekday.
  const dayOfWeek = new Date(`${dateStr}T12:00:00-03:00`).getDay()
  try {
    const service = createServiceClient()

    // Botão "Atendimento 24h" (Configurações → SDR → Horários) : ligado,
    // ignora business_hours e feriado por completo -- 24h de verdade, todo
    // dia, inclusive pra oferta de horário de reunião, sem precisar apagar a
    // configuração normal que fica guardada pra quando desligar de novo.
    const { data: cfg24h } = await service
      .from('sdr_configs')
      .select('horario_24h_ativo')
      .eq('company_id', companyId)
      .maybeSingle()
    if (cfg24h?.horario_24h_ativo) {
      openTime = '00:00'
      closeTime = '23:59'
      diaFechado = false
    } else {
      const { data: hoursRows } = await service
        .from('business_hours')
        .select('day_of_week, open_time, close_time, closed')
        .eq('company_id', companyId)
        .is('wa_number_id', null)

      if (hoursRows && hoursRows.length > 0) {
        const today = hoursRows.find((r) => r.day_of_week === dayOfWeek)
        if (!today || today.closed || !today.open_time || !today.close_time) {
          diaFechado = true
        } else {
          openTime = today.open_time.slice(0, 5)
          closeTime = today.close_time.slice(0, 5)
        }
      } else {
        // Achado ao vivo (Rodrigo, 2026-09-04) : sem NENHUMA linha configurada,
        // o fallback abria sábado e domingo também (só bloqueava feriado) --
        // regressão em relação ao hardcoded Seg-Sex 9h-18h de antes desta
        // função passar a ler business_hours. O SDR continua respondendo
        // mensagem todo dia (isWithinBusinessHours, lib/sdr/business-hours.ts,
        // tem seu próprio "sem linha = sempre aberto" -- isso não muda), só a
        // OFERTA DE HORÁRIO DE REUNIÃO volta a assumir Seg-Sex por padrão.
        if (dayOfWeek === 0 || dayOfWeek === 6) diaFechado = true
      }
    }
  } catch {
    // Falha ao ler business_hours : mantém o fallback Seg-Sex 9h-18h, nunca quebra o agendamento por isso
    if (dayOfWeek === 0 || dayOfWeek === 6) diaFechado = true
  }

  if (diaFechado) return []

  const dayStart = parseBrazilDateTime(`${dateStr}T${openTime}:00`)
  const dayEnd = parseBrazilDateTime(`${dateStr}T${closeTime}:00`)

  // Busca eventos existentes no dia
  const { data } = await calendar.events.list({
    calendarId,
    timeMin: dayStart.toISOString(),
    timeMax: dayEnd.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
    timeZone: 'America/Sao_Paulo',
  })

  const busyIntervals = (data.items ?? [])
    .filter((e) => e.status !== 'cancelled')
    .map((e) => ({
      start: new Date(e.start?.dateTime ?? e.start?.date ?? ''),
      end: new Date(e.end?.dateTime ?? e.end?.date ?? ''),
    }))

  // Gera slots de 1h das 9h às 17h
  const slots: CalendarSlot[] = []
  let cursor = new Date(dayStart)

  while (cursor.getTime() + durationMinutes * 60_000 <= dayEnd.getTime()) {
    const slotEnd = new Date(cursor.getTime() + durationMinutes * 60_000)
    const overlaps = busyIntervals.some(
      (b) => cursor < b.end && slotEnd > b.start
    )
    slots.push({ start: new Date(cursor), end: slotEnd, available: !overlaps })
    cursor = new Date(cursor.getTime() + 30 * 60_000) // avança 30min
  }

  return slots
}

/** Cria evento com Google Meet e retorna link */
export async function createEventWithMeet(
  params: CreateEventParams
): Promise<ScheduledEvent> {
  const {
    calendarId,
    companyId,
    title,
    description,
    start,
    durationMinutes = 60,
    attendeeEmail,
    attendeeName,
  } = params

  const calendar = await getCalendarClientForCompany(companyId)
  const end = new Date(start.getTime() + durationMinutes * 60_000)

  const eventBody: calendar_v3.Schema$Event = {
    summary: title,
    description: description ?? 'Call agendada via Nexio.AI SDR',
    start: { dateTime: start.toISOString(), timeZone: 'America/Sao_Paulo' },
    end: { dateTime: end.toISOString(), timeZone: 'America/Sao_Paulo' },
    conferenceData: {
      createRequest: {
        requestId: `nexio-${Date.now()}`,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    },
    attendees: attendeeEmail
      ? [{ email: attendeeEmail, displayName: attendeeName }]
      : [],
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'email', minutes: 24 * 60 },
        { method: 'popup', minutes: 30 },
      ],
    },
  }

  const { data } = await calendar.events.insert({
    calendarId,
    requestBody: eventBody,
    conferenceDataVersion: 1,
    sendUpdates: attendeeEmail ? 'all' : 'none',
  })

  const meetUrl =
    data.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video')?.uri ??
    data.hangoutLink ??
    ''

  return {
    eventId: data.id ?? '',
    meetUrl,
    start,
    end,
    title: data.summary ?? title,
  }
}

/** Cancela evento no Google Calendar */
export async function cancelEvent(calendarId: string, eventId: string, companyId: number): Promise<void> {
  const calendar = await getCalendarClientForCompany(companyId)
  await calendar.events.delete({ calendarId, eventId, sendUpdates: 'all' })
}

/** Busca um evento específico direto no Google Calendar (fonte da verdade, não o
 * banco) : usado pra confirmar se uma reunião "marcada" segundo o CRM ainda existe
 * de verdade, sem depender do banco ter sido atualizado quando alguém cancela/deleta
 * o evento manualmente no Calendar. Retorna null se não existir ou tiver sido cancelado. */
export async function getEvent(
  calendarId: string,
  eventId: string,
  companyId: number
): Promise<ScheduledEvent | null> {
  const calendar = await getCalendarClientForCompany(companyId)
  try {
    const { data } = await calendar.events.get({ calendarId, eventId })
    if (!data || data.status === 'cancelled') return null
    const startIso = data.start?.dateTime ?? data.start?.date
    const endIso = data.end?.dateTime ?? data.end?.date
    if (!startIso || !endIso) return null
    const meetUrl =
      data.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video')?.uri ??
      data.hangoutLink ??
      ''
    return {
      eventId: data.id ?? eventId,
      meetUrl,
      start: new Date(startIso),
      end: new Date(endIso),
      title: data.summary ?? '',
    }
  } catch (err: any) {
    // 404/410 = evento não existe mais (deletado) : trata como "sem reunião", não como erro
    if (err?.code === 404 || err?.code === 410) return null
    throw err
  }
}

/** Formata data/hora para exibição em PT-BR (fuso America/Sao_Paulo) */
export function formatDateTimeBR(date: Date): string {
  return date.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Verifica se é dia útil (Seg-Sex) no fuso Bahia */
export function isBusinessDay(date: Date): boolean {
  const day = new Date(date.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' })).getDay()
  return day >= 1 && day <= 5
}

/** Retorna próximo dia útil a partir de amanhã */
export function nextBusinessDay(from: Date = new Date()): Date {
  const next = new Date(from)
  next.setDate(next.getDate() + 1)
  while (!isBusinessDay(next)) {
    next.setDate(next.getDate() + 1)
  }
  next.setHours(9, 0, 0, 0)
  return next
}
