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

    // Buscar configuração
    const { data: config, error } = await supabase
      .from('lead_qualification_config')
      .select('*')
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return NextResponse.json({
      success: true,
      data: config || {
        webhook_url: null,
        webhook_secret: null,
        is_active: false,
      },
    });
  } catch (error: any) {
    console.error('Error fetching lead qualification config:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Erro ao buscar configuração' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
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

    const body = await request.json();
    const { webhook_url, webhook_secret, is_active } = body;

    // Verificar se já existe uma configuração
    const { data: existing } = await supabase
      .from('lead_qualification_config')
      .select('id')
      .single();

    let data, error;

    if (existing) {
      // Atualizar
      ({ data, error } = await supabase
        .from('lead_qualification_config')
        .update({
          webhook_url,
          webhook_secret,
          is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single());
    } else {
      // Criar
      ({ data, error } = await supabase
        .from('lead_qualification_config')
        .insert([{
          webhook_url,
          webhook_secret,
          is_active,
        }])
        .select()
        .single());
    }

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'Configuração atualizada com sucesso!',
      data,
    });
  } catch (error: any) {
    console.error('Error updating lead qualification config:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Erro ao atualizar configuração' },
      { status: 500 }
    );
  }
}
