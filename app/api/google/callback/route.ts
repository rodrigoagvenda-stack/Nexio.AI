import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getPlatformConfig } from '@/lib/platform-config';
import crypto from 'crypto';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  if (error || !code || !state) {
    return NextResponse.redirect(`${appUrl}/configuracoes?google=error`);
  }

  // Validar CSRF token — state = "{csrfToken}:{companyId}"
  const colonIdx = state.indexOf(':');
  const csrfToken = colonIdx > 0 ? state.slice(0, colonIdx) : '';
  const companyIdStr = colonIdx > 0 ? state.slice(colonIdx + 1) : state;

  const expectedCsrf = request.cookies.get('google_oauth_csrf')?.value ?? '';
  const csrfValid = expectedCsrf.length > 0 &&
    csrfToken.length > 0 &&
    crypto.timingSafeEqual(Buffer.from(csrfToken.padEnd(64)), Buffer.from(expectedCsrf.padEnd(64)));

  if (!csrfValid) {
    console.warn('[google/callback] CSRF token inválido — possível ataque CSRF');
    return NextResponse.redirect(`${appUrl}/configuracoes?google=error`);
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
        console.warn('[google/callback] companyId do state não bate com sessão — possível IDOR');
        return NextResponse.redirect(`${appUrl}/configuracoes?google=error`);
      }
    }

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

    const successResponse = NextResponse.redirect(`${appUrl}/configuracoes?google=success`);
    successResponse.cookies.delete('google_oauth_csrf');
    return successResponse;
  } catch (err: any) {
    console.error('[google/callback]', err);
    const errResponse = NextResponse.redirect(`${appUrl}/configuracoes?google=error`);
    errResponse.cookies.delete('google_oauth_csrf');
    return errResponse;
  }
}
