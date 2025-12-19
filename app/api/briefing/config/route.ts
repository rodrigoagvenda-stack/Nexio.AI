import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Verificar autenticação admin
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, message: 'Não autorizado' }, { status: 401 });
    }

    const { data: adminUser } = await supabase
      .from('admin_users')
      .select('*')
      .eq('auth_user_id', user.id)
      .eq('is_active', true)
      .single();

    if (!adminUser) {
      return NextResponse.json({ success: false, message: 'Acesso negado' }, { status: 403 });
    }

    // Buscar configuração
    const { data, error } = await supabase.from('briefing_config').select('*').single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: data || {},
    });
  } catch (error: any) {
    console.error('Error fetching briefing config:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Erro ao buscar configuração' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Verificar autenticação admin
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, message: 'Não autorizado' }, { status: 401 });
    }

    const { data: adminUser } = await supabase
      .from('admin_users')
      .select('*')
      .eq('auth_user_id', user.id)
      .eq('is_active', true)
      .single();

    if (!adminUser) {
      return NextResponse.json({ success: false, message: 'Acesso negado' }, { status: 403 });
    }

    const body = await request.json();
    const { webhook_url, webhook_secret, is_active } = body;

    // Atualizar configuração
    const { data, error } = await supabase
      .from('briefing_config')
      .update({
        webhook_url,
        webhook_secret,
        is_active,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'Webhook configurado com sucesso!',
      data,
    });
  } catch (error: any) {
    console.error('Error updating briefing config:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Erro ao atualizar configuração' },
      { status: 500 }
    );
  }
}
