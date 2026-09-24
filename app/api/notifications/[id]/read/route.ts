import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/require-auth';

// POST /api/notifications/[id]/read : marca UMA notificação da empresa como lida.
// Confere a empresa de quem está logado: antes bastava conhecer o id para alterar o aviso de outra empresa
// (a única barreira era o RLS).
export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { context, error: authError } = await requireAuth(request);
  if (authError) return authError;

  const { id } = await props.params;
  if (!/^\d{1,18}$/.test(id)) {
    return NextResponse.json({ success: false, message: 'Id inválido' }, { status: 400 });
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from('activity_logs')
    .update({ read: true, read_at: new Date().toISOString() })
    .eq('id', id)
    .eq('company_id', context.companyId)
    .select('id');

  if (error) {
    console.error('Error marking notification as read:', error);
    return NextResponse.json({ success: false, message: 'Erro ao marcar notificação como lida' }, { status: 500 });
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ success: false, message: 'Notificação não encontrada' }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
