/**
 * Google Calendar integration — cria eventos com Meet para agendamento de calls.
 * Usa OAuth2 por empresa (google_integrations). Service account removido.
 */

import { google, calendar_v3 } from 'googleapis'
import { createServiceClient } from '@/lib/supabase/server'

/** Retorna cliente Calendar usando OAuth tokens da empresa */
async function getCalendarClientForCompany(companyId: number) {
  const service = createServiceClient();
  const { data: integration } = await service
    .from('google_integrations')
    .select('access_token, refresh_token, expires_at')
    .eq('company_id', companyId)
    .single();

  if (!integration?.refresh_token) {
    throw new Error('Google Calendar não conectado para esta empresa');
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    `${process.env.NEXT_PUBLIC_APP_URL}/api/google/callback`
  );

  oauth2Client.setCredentials({
    access_token: integration.access_token,
    refresh_token: integration.refresh_token,
    expiry_date: integration.expires_at ? new Date(integration.expires_at).getTime() : undefined,
  });

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

/** Verifica slots disponíveis em um dia (Seg-Sex, 9h-18h, fuso America/Bahia) */
export async function checkAvailableSlots(
  params: CheckSlotsParams
): Promise<CalendarSlot[]> {
  const { calendarId, companyId, date, durationMinutes = 60 } = params
  const calendar = await getCalendarClientForCompany(companyId)

  const dayStart = new Date(date)
  dayStart.setHours(9, 0, 0, 0)
  const dayEnd = new Date(date)
  dayEnd.setHours(18, 0, 0, 0)

  const { data } = await calendar.events.list({
    calendarId,
    timeMin: dayStart.toISOString(),
    timeMax: dayEnd.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
    timeZone: 'America/Bahia',
  })

  const busyIntervals = (data.items ?? [])
    .filter((e) => e.status !== 'cancelled')
    .map((e) => ({
      start: new Date(e.start?.dateTime ?? e.start?.date ?? ''),
      end: new Date(e.end?.dateTime ?? e.end?.date ?? ''),
    }))

  const slots: CalendarSlot[] = []
  let cursor = new Date(dayStart)

  while (cursor.getTime() + durationMinutes * 60_000 <= dayEnd.getTime()) {
    const slotEnd = new Date(cursor.getTime() + durationMinutes * 60_000)
    const overlaps = busyIntervals.some(
      (b) => cursor < b.end && slotEnd > b.start
    )
    slots.push({ start: new Date(cursor), end: slotEnd, available: !overlaps })
    cursor = new Date(cursor.getTime() + 30 * 60_000)
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
    start: { dateTime: start.toISOString(), timeZone: 'America/Bahia' },
    end: { dateTime: end.toISOString(), timeZone: 'America/Bahia' },
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
export async function cancelEvent(
  calendarId: string,
  eventId: string,
  companyId: number
): Promise<void> {
  const calendar = await getCalendarClientForCompany(companyId)
  await calendar.events.delete({ calendarId, eventId, sendUpdates: 'all' })
}

/** Formata data/hora para exibição em PT-BR (fuso America/Bahia) */
export function formatDateTimeBR(date: Date): string {
  return date.toLocaleString('pt-BR', {
    timeZone: 'America/Bahia',
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Verifica se é dia útil (Seg-Sex) no fuso Bahia */
export function isBusinessDay(date: Date): boolean {
  const day = new Date(date.toLocaleString('en-US', { timeZone: 'America/Bahia' })).getDay()
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
