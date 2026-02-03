import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { encrypt, decrypt } from '@/lib/crypto';

// PUT /api/admin/n8n/instances/[id] - Atualiza instância
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
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

    // Monta objeto de atualização
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (name !== undefined) updateData.name = name;
    if (url !== undefined) updateData.url = url;
    if (check_interval !== undefined) updateData.check_interval = check_interval;
    if (active !== undefined) updateData.active = active;

    // Se API key foi fornecida, criptografa
    if (api_key && api_key !== '****************') {
      updateData.api_key = encrypt(api_key);
    }

    // Atualiza no banco
    const { data, error } = await supabase
      .from('n8n_instances')
      .update(updateData)
      .eq('id', params.id)
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
    console.error('Erro ao atualizar instância:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao atualizar instância' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/n8n/instances/[id] - Deleta instância
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
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

    // Deleta do banco
    const { error } = await supabase
      .from('n8n_instances')
      .delete()
      .eq('id', params.id);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Erro ao deletar instância:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao deletar instância' },
      { status: 500 }
    );
  }
}
