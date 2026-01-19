import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET /api/admin/asaas/cobrancas
export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url);
    const agente_id = searchParams.get('agente_id');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');

    let query = supabase
      .from('asaas_cobrancas')
      .select(
        `
        *,
        agente:asaas_agentes(id, name)
      `
      )
      .order('created_at', { ascending: false })
      .limit(limit);

    if (agente_id) {
      query = query.eq('agente_id', agente_id);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data: cobrancas, error } = await query;

    if (error) {
      throw error;
    }

    return NextResponse.json({ cobrancas });
  } catch (error: any) {
    console.error('Erro ao buscar cobranças:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar cobranças' },
      { status: 500 }
    );
  }
}
