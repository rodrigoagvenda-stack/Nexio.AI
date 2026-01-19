import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET /api/admin/n8n/errors - Lista erros
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
    const instance_id = searchParams.get('instance_id');
    const resolved = searchParams.get('resolved');
    const severity = searchParams.get('severity');
    const limit = parseInt(searchParams.get('limit') || '50');

    let query = supabase
      .from('n8n_errors')
      .select(
        `
        *,
        instance:n8n_instances(id, name, url)
      `
      )
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (instance_id) {
      query = query.eq('instance_id', instance_id);
    }

    if (resolved === 'true') {
      query = query.eq('resolved', true);
    } else if (resolved === 'false') {
      query = query.eq('resolved', false);
    }

    if (severity) {
      query = query.eq('severity', severity);
    }

    const { data: errors, error } = await query;

    if (error) {
      throw error;
    }

    return NextResponse.json({ errors });
  } catch (error: any) {
    console.error('Erro ao buscar erros:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar erros' },
      { status: 500 }
    );
  }
}
