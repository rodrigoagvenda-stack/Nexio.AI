import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/require-auth';

// POST /api/notifications/read : marca várias notificações da empresa como lidas numa chamada só.
// Corpo: { ids: ["12", "13"] } marca essas; { all: true } marca todas as não lidas da empresa.
// ("Marcar tudo como lido" fazia uma requisição por aviso.)
export async function POST(request: NextRequest) {
  const { context, error: authError } = await requireAuth(request);
  if (authError) return authError;

  let body: { ids?: unknown; all?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: 'Corpo inválido' }, { status: 400 });
  }

  const service = createServiceClient();
  let query = service
    .from('activity_logs')
    .update({ read: true, read_at: new Date().toISOString() })
    .eq('company_id', context.companyId)
    .neq('read', true);

  if (body.all === true) {
    // todas as não lidas da empresa
  } else if (Array.isArray(body.ids) && body.ids.length > 0 && body.ids.length <= 500) {
    const ids = body.ids.map((v) => String(v));
    if (!ids.every((v) => /^\d{1,18}$/.test(v))) {
      return NextResponse.json({ success: false, message: 'Ids inválidos' }, { status: 400 });
    }
    query = query.in('id', ids);
  } else {
    return NextResponse.json({ success: false, message: 'Informe ids (até 500) ou all: true' }, { status: 400 });
  }

  const { data, error } = await query.select('id');
  if (error) {
    console.error('Error marking notifications as read:', error);
    return NextResponse.json({ success: false, message: 'Erro ao marcar como lidas' }, { status: 500 });
  }
  return NextResponse.json({ success: true, updated: data?.length ?? 0 });
}
