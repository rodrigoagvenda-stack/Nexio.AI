import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// DELETE /api/admin/asaas/agentes/[id]
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const { data: adminUser } = await supabase
      .from('admin_users')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (!adminUser) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const { error } = await supabase
      .from('asaas_agentes')
      .delete()
      .eq('id', params.id);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Erro ao deletar agente:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao deletar agente' },
      { status: 500 }
    );
  }
}
