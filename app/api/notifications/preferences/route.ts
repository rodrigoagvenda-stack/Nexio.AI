import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/require-auth';
import { sanitizePrefs } from '@/lib/notifications/prefs-shared';

// GET /api/notifications/preferences : preferências de notificação da pessoa logada
// PUT /api/notifications/preferences : salva (corpo: { sound, handoff, messages, billing, ownActions })
export async function GET(request: NextRequest) {
  const { context, error: authError } = await requireAuth(request);
  if (authError) return authError;

  const service = createServiceClient();
  const { data } = await service
    .from('user_notification_prefs')
    .select('prefs')
    .eq('auth_user_id', context.userId)
    .maybeSingle();

  return NextResponse.json({ success: true, prefs: sanitizePrefs(data?.prefs) });
}

export async function PUT(request: NextRequest) {
  const { context, error: authError } = await requireAuth(request);
  if (authError) return authError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: 'Corpo inválido' }, { status: 400 });
  }

  const prefs = sanitizePrefs(body);
  const service = createServiceClient();
  const { error } = await service
    .from('user_notification_prefs')
    .upsert({ auth_user_id: context.userId, prefs, updated_at: new Date().toISOString() }, { onConflict: 'auth_user_id' });

  if (error) {
    console.error('[notification-prefs] erro ao salvar:', error.message);
    return NextResponse.json({ success: false, message: 'Não foi possível salvar as preferências' }, { status: 500 });
  }
  return NextResponse.json({ success: true, prefs });
}
