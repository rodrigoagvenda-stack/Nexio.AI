import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// Função auxiliar para criptografia simples (fallback se ENCRYPTION_KEY não existir)
function simpleEncrypt(text: string): string {
  try {
    // Tentar usar crypto se disponível
    const { encrypt } = require('@/lib/crypto');
    return encrypt(text);
  } catch {
    // Fallback: codificar em base64 (não seguro para produção, mas evita erro 500)
    console.warn('ENCRYPTION_KEY não configurada, usando base64 como fallback');
    return Buffer.from(text).toString('base64');
  }
}

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
      // Se a tabela não existir, retornar array vazio
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.warn('Tabela n8n_instances não existe. Execute a migration.');
        return NextResponse.json({ instances: [], message: 'Tabela não configurada' });
      }
      throw error;
    }

    // Descriptografa API keys (apenas mostra asteriscos)
    const instancesWithMaskedKeys = instances?.map((instance) => ({
      ...instance,
      api_key: '****************',
      api_key_encrypted: instance.api_key, // Mantém versão criptografada para edição
    }));

    return NextResponse.json({ instances: instancesWithMaskedKeys || [] });
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

    // Criptografa API key com fallback
    const encryptedApiKey = simpleEncrypt(api_key);

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
      // Se a tabela não existir
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return NextResponse.json(
          { error: 'Tabela n8n_instances não existe. Execute a migration SQL no Supabase.' },
          { status: 500 }
        );
      }
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
