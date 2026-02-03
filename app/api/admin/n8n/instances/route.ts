import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { encrypt, decrypt } from '@/lib/crypto';

// GET /api/admin/n8n/instances - Lista todas as instâncias
export async function GET() {
  try {
    const supabase = await createClient();

    // Verifica se é admin
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

    // Busca instâncias
    const { data: instances, error } = await supabase
      .from('n8n_instances')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    // Descriptografa API keys (apenas mostra asteriscos)
    const instancesWithMaskedKeys = instances?.map((instance) => ({
      ...instance,
      api_key: '****************',
      api_key_encrypted: instance.api_key, // Mantém versão criptografada para edição
    }));

    return NextResponse.json({ instances: instancesWithMaskedKeys });
  } catch (error: any) {
    console.error('Erro ao buscar instâncias:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar instâncias' },
      { status: 500 }
    );
  }
}

// POST /api/admin/n8n/instances - Cria nova instância
export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // Verifica se é admin
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
    const { name, url, api_key, check_interval, active } = body;

    // Validações
    if (!name || !url || !api_key) {
      return NextResponse.json(
        { error: 'Nome, URL e API key são obrigatórios' },
        { status: 400 }
      );
    }

    // Criptografa API key
    const encryptedApiKey = encrypt(api_key);

    // Insere no banco
    const { data, error } = await supabase
      .from('n8n_instances')
      .insert({
        name,
        url,
        api_key: encryptedApiKey,
        check_interval: check_interval || 5,
        active: active !== undefined ? active : true,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      instance: {
        ...data,
        api_key: '****************',
      },
    });
  } catch (error: any) {
    console.error('Erro ao criar instância:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao criar instância' },
      { status: 500 }
    );
  }
}
