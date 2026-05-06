import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth';
import { getPlatformConfig } from '@/lib/platform-config';

export async function GET(request: NextRequest) {
  const { context, error: authError } = await requireAuth(request);
  if (authError) return authError;

  const { google } = await import('googleapis');
  const cfg = await getPlatformConfig();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
  const oauth2Client = new google.auth.OAuth2(
    cfg.google_client_id,
    cfg.google_client_secret,
    `${appUrl}/api/google/callback`
  );

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/userinfo.email',
    ],
    state: String(context.companyId),
  });

  return NextResponse.redirect(url);
}
