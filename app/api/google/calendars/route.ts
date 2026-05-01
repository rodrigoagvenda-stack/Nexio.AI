import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { requireAuth } from '@/lib/auth/require-auth'
import { createServiceClient } from '@/lib/supabase/server'
import { getPlatformConfig } from '@/lib/platform-config'

export async function GET(request: NextRequest) {
  const { context, error: authError } = await requireAuth(request)
  if (authError) return authError

  const service = createServiceClient()
  const { data: integration } = await service
    .from('google_integrations')
    .select('access_token, refresh_token, expires_at')
    .eq('company_id', context.companyId)
    .single()

  if (!integration?.refresh_token) {
    return NextResponse.json({ error: 'Google Calendar não conectado' }, { status: 400 })
  }

  try {
    const cfg = await getPlatformConfig()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
    const oauth2Client = new google.auth.OAuth2(
      cfg.google_client_id,
      cfg.google_client_secret,
      `${appUrl}/api/google/callback`
    )
    oauth2Client.setCredentials({
      access_token: integration.access_token,
      refresh_token: integration.refresh_token,
    })

    // Refresh token if expired
    if (integration.expires_at && new Date(integration.expires_at) < new Date()) {
      const { credentials } = await oauth2Client.refreshAccessToken()
      oauth2Client.setCredentials(credentials)
      await service.from('google_integrations').update({
        access_token: credentials.access_token,
        expires_at: credentials.expiry_date ? new Date(credentials.expiry_date).toISOString() : null,
        updated_at: new Date().toISOString(),
      }).eq('company_id', context.companyId)
    }

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client })
    const { data } = await calendar.calendarList.list({ minAccessRole: 'writer' })

    const calendars = (data.items ?? []).map((c) => ({
      id: c.id,
      summary: c.summary,
      primary: c.primary ?? false,
      backgroundColor: c.backgroundColor,
    }))

    return NextResponse.json({ calendars })
  } catch (err: any) {
    console.error('[google/calendars]', err)
    return NextResponse.json({ error: err.message || 'Erro ao buscar calendários' }, { status: 500 })
  }
}
