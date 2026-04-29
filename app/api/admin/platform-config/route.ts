import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getPlatformConfigForAdmin, setPlatformConfigKey, SENSITIVE_KEYS } from '@/lib/platform-config';

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from('admin_users')
    .select('id')
    .eq('auth_user_id', user.id)
    .eq('is_active', true)
    .single();
  return data ? user : null;
}

export async function GET() {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

    const config = await getPlatformConfigForAdmin();
    return NextResponse.json({ config });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

    const body: Record<string, string> = await request.json();
    const MASK = '••••••••••••••••';

    const updates = Object.entries(body).filter(
      ([, v]) => v && v !== MASK
    );

    for (const [key, value] of updates) {
      await setPlatformConfigKey(key, value);
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
