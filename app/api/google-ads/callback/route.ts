import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getPlatformConfig } from '@/lib/platform-config';
import { encrypt } from '@/lib/crypto';
import crypto from 'crypto';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  if (error || !code || !state) {
    return NextResponse.redirect(`${appUrl}/configuracoes/sdr?tab=integracoes&google_ads=error`);
  }

  // Validar CSRF token : state = "{csrfToken}:{companyId}"
  const colonIdx = state.indexOf(':');
  const csrfToken = colonIdx > 0 ? state.slice(0, colonIdx) : '';
  const companyIdStr = colonIdx > 0 ? state.slice(colonIdx + 1) : state;

  const expectedCsrf = request.cookies.get('google_ads_oauth_csrf')?.value ?? '';
  const csrfValid = expectedCsrf.length > 0 &&
    csrfToken.length > 0 &&
    crypto.timingSafeEqual(Buffer.from(csrfToken.padEnd(64)), Buffer.from(expectedCsrf.padEnd(64)));

  if (!csrfValid) {
    console.warn('[google-ads/callback] CSRF token inválido : possível ataque CSRF');
    return NextResponse.redirect(`${appUrl}/configuracoes/sdr?tab=integracoes&google_ads=error`);
  }

  try {
    const companyId = parseInt(companyIdStr);
    if (!companyId) throw new Error('company_id inválido');

    // Validar que o companyId do state pertence ao usuário autenticado
    const { createClient: createSupa } = await import('@/lib/supabase/server');
    const supabaseCheck = await createSupa();
    const { data: { user: sessionUser } } = await supabaseCheck.auth.getUser();
    if (sessionUser) {
      const { data: userRow } = await supabaseCheck.from('users').select('company_id').eq('auth_user_id', sessionUser.id).single();
      if (userRow && userRow.company_id !== companyId) {
        console.warn('[google-ads/callback] companyId do state não bate com sessão : possível IDOR');
        return NextResponse.redirect(`${appUrl}/configuracoes/sdr?tab=integracoes&google_ads=error`);
      }
    }

    const { google } = await import('googleapis');
    const cfg = await getPlatformConfig();
    const oauth2Client = new google.auth.OAuth2(
      cfg.google_client_id,
      cfg.google_client_secret,
      `${appUrl}/api/google-ads/callback`
    );
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      return NextResponse.redirect(`${appUrl}/configuracoes/sdr?tab=integracoes&google_ads=no_refresh_token`);
    }

    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: userInfo } = await oauth2.userinfo.get();

    const service = createServiceClient();

    const expiresAt = tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null;

    await service.from('google_ads_integrations').upsert({
      company_id: companyId,
      access_token: tokens.access_token,
      refresh_token: encrypt(tokens.refresh_token), // criptografado (diferente do google_integrations do Calendar, que guarda em texto puro)
      expires_at: expiresAt,
      scope: tokens.scope,
      email: userInfo.email,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'company_id' });

    const successResponse = NextResponse.redirect(`${appUrl}/configuracoes/sdr?tab=integracoes&google_ads=success`);
    successResponse.cookies.delete('google_ads_oauth_csrf');
    return successResponse;
  } catch (err: any) {
    console.error('[google-ads/callback]', err);
    const errResponse = NextResponse.redirect(`${appUrl}/configuracoes/sdr?tab=integracoes&google_ads=error`);
    errResponse.cookies.delete('google_ads_oauth_csrf');
    return errResponse;
  }
}
