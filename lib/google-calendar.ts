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

/** Verifica slots disponíveis em um dia (Seg-Sex, 9h-18h, fuso America/Sao_Paulo) */
export async function checkAvailableSlots(
  params: CheckSlotsParams
): Promise<CalendarSlot[]> {
  const { calendarId, companyId, date, durationMinutes = 60 } = params
  const calendar = await getCalendarClientForCompany(companyId)

  // Define janela 9h–18h no fuso Brasil (DST-aware via parseBrazilDateTime)
  const dateStr = date.toISOString().slice(0, 10)
  const dayStart = parseBrazilDateTime(`${dateStr}T09:00:00`)
  const dayEnd = parseBrazilDateTime(`${dateStr}T18:00:00`)

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
