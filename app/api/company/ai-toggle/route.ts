import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/require-auth';

export async function PATCH(request: NextRequest) {
  const { context, error: authError } = await requireAuth(request);
  if (authError) return authError;

  if (!['admin', 'company_admin', 'manager'].includes(context.role)) {
    return NextResponse.json({ success: false, message: 'Apenas administradores podem alterar este recurso' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { is_active } = body;

    if (typeof is_active !== 'boolean') {
      return NextResponse.json(
        { success: false, message: 'Campo is_active deve ser boolean' },
        { status: 400 }
      );
    }

    const serviceSupabase = createServiceClient();

    const { data, error } = await serviceSupabase
      .from('companies')
      .update({ is_active })
      .eq('id', context.companyId)
      .select('id, is_active')
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Error toggling AI:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Erro ao atualizar IA' },
      { status: 500 }
    );
  }
}
