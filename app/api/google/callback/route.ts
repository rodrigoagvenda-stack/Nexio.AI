import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getPlatformConfig } from '@/lib/platform-config';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state'); // company_id
  const error = searchParams.get('error');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  if (error || !code || !state) {
    return NextResponse.redirect(`${appUrl}/configuracoes?google=error`);
  }

  try {
    const companyId = parseInt(state);
    if (!companyId) throw new Error('company_id inválido');

    const { google } = await import('googleapis')
    const cfg = await getPlatformConfig();
    const oauth2Client = new google.auth.OAuth2(
      cfg.google_client_id,
      cfg.google_client_secret,
      `${appUrl}/api/google/callback`
    );
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      return NextResponse.redirect(`${appUrl}/configuracoes?google=no_refresh_token`);
    }

    // Buscar email da conta Google
    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: userInfo } = await oauth2.userinfo.get();

    const service = createServiceClient();

    const expiresAt = tokens.expiry_date
      ? new Date(tokens.expiry_date).toISOString()
      : null;

    await service.from('google_integrations').upsert({
      company_id: companyId,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: expiresAt,
      scope: tokens.scope,
      email: userInfo.email,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'company_id' });

    return NextResponse.redirect(`${appUrl}/configuracoes?google=success`);
  } catch (err: any) {
    console.error('[google/callback]', err);
    return NextResponse.redirect(`${appUrl}/configuracoes?google=error`);
  }
}
