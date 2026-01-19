import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { encrypt, decrypt } from '@/lib/crypto';

// GET /api/admin/ai/config - Busca config da IA
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
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (!adminUser) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const { data: config, error } = await supabase
      .from('ai_config')
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
        api_key: '****************',
      },
    });
  } catch (error: any) {
    console.error('Erro ao buscar config IA:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar config' },
      { status: 500 }
    );
  }
}

// PUT /api/admin/ai/config - Atualiza config da IA
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
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (!adminUser) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const body = await request.json();
    const { provider, model, api_key } = body;

    if (!provider || !model) {
      return NextResponse.json(
        { error: 'Provider e model são obrigatórios' },
        { status: 400 }
      );
    }

    // Busca config existente
    const { data: existingConfig } = await supabase
      .from('ai_config')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const updateData: any = {
      provider,
      model,
      updated_at: new Date().toISOString(),
    };

    // Só criptografa se nova API key foi fornecida
    if (api_key && api_key !== '****************') {
      updateData.api_key = encrypt(api_key);
    }

    if (existingConfig) {
      // Atualiza
      const { data, error } = await supabase
        .from('ai_config')
        .update(updateData)
        .eq('id', existingConfig.id)
        .select()
        .single();

      if (error) throw error;

      return NextResponse.json({
        config: {
          ...data,
          api_key: '****************',
        },
      });
    } else {
      // Cria novo (precisa de API key)
      if (!api_key || api_key === '****************') {
        return NextResponse.json(
          { error: 'API key é obrigatória para criar configuração' },
          { status: 400 }
        );
      }

      updateData.api_key = encrypt(api_key);

      const { data, error } = await supabase
        .from('ai_config')
        .insert(updateData)
        .select()
        .single();

      if (error) throw error;

      return NextResponse.json({
        config: {
          ...data,
          api_key: '****************',
        },
      });
    }
  } catch (error: any) {
    console.error('Erro ao atualizar config IA:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao atualizar config' },
      { status: 500 }
    );
  }
}
