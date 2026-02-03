import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { encrypt, decrypt } from '@/lib/crypto';

// GET /api/admin/uazapi/config
export async function GET() {
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
      .eq('auth_user_id', user.id)
      .eq('is_active', true)
      .single();

    if (!adminUser) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const { data: config, error } = await supabase
      .from('uazapi_config')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    if (!config) {
      return NextResponse.json({ config: null });
    }

    return NextResponse.json({
      config: {
        ...config,
        api_token: '****************',
      },
    });
  } catch (error: any) {
    console.error('Erro ao buscar config Uazapi:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar config' },
      { status: 500 }
    );
  }
}

// PUT /api/admin/uazapi/config
export async function PUT(request: Request) {
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
      .eq('auth_user_id', user.id)
      .eq('is_active', true)
      .single();

    if (!adminUser) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const body = await request.json();
    const { api_token, instance, phone } = body;

    if (!instance || !phone) {
      return NextResponse.json(
        { error: 'Instância e telefone são obrigatórios' },
        { status: 400 }
      );
    }

    // Busca config existente
    const { data: existingConfig } = await supabase
      .from('uazapi_config')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const updateData: any = {
      instance,
      phone,
      updated_at: new Date().toISOString(),
    };

    if (api_token && api_token !== '****************') {
      updateData.api_token = encrypt(api_token);
    }

    if (existingConfig) {
      const { data, error } = await supabase
        .from('uazapi_config')
        .update(updateData)
        .eq('id', existingConfig.id)
        .select()
        .single();

      if (error) throw error;

      return NextResponse.json({
        config: {
          ...data,
          api_token: '****************',
        },
      });
    } else {
      if (!api_token || api_token === '****************') {
        return NextResponse.json(
          { error: 'API token é obrigatório para criar configuração' },
          { status: 400 }
        );
      }

      updateData.api_token = encrypt(api_token);

      const { data, error } = await supabase
        .from('uazapi_config')
        .insert(updateData)
        .select()
        .single();

      if (error) throw error;

      return NextResponse.json({
        config: {
          ...data,
          api_token: '****************',
        },
      });
    }
  } catch (error: any) {
    console.error('Erro ao atualizar config Uazapi:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao atualizar config' },
      { status: 500 }
    );
  }
}
