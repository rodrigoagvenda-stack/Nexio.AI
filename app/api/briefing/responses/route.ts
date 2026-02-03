import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Verificar autenticação
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, message: 'Não autorizado' }, { status: 401 });
    }

    // Verificar se é admin
    const { data: adminUser } = await supabase
      .from('admin_users')
      .select('*')
      .eq('auth_user_id', user.id)
      .eq('is_active', true)
      .single();

    if (!adminUser) {
      return NextResponse.json({ success: false, message: 'Acesso negado' }, { status: 403 });
    }

    // Buscar parâmetros de query
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Buscar respostas
    let query = supabase
      .from('briefing_responses')
      .select('*', { count: 'exact' })
      .order('submitted_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      query = query.or(
        `nome_responsavel.ilike.%${search}%,email.ilike.%${search}%,nome_empresa.ilike.%${search}%`
      );
    }

    const { data, error, count } = await query;

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: data || [],
      total: count || 0,
    });
  } catch (error: any) {
    console.error('Error fetching briefing responses:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Erro ao buscar respostas' },
      { status: 500 }
    );
  }
}
