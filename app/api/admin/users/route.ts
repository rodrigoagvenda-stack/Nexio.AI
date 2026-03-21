import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

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

    // Usar service client para buscar admin e todos os usuários (bypassa RLS)
    const serviceSupabase = createServiceClient();

    const { data: adminUser } = await serviceSupabase
      .from('admin_users')
      .select('*')
      .eq('auth_user_id', user.id)
      .eq('is_active', true)
      .single();

    if (!adminUser) {
      return NextResponse.json({ success: false, message: 'Acesso negado' }, { status: 403 });
    }

    // 🚀 PAGINAÇÃO: Ler parâmetros da URL
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    // 🚀 OTIMIZAÇÃO: Buscar apenas campos necessários com paginação
    const { data: users, error, count } = await serviceSupabase
      .from('users')
      .select(`
        id,
        name,
        email,
        department,
        role,
        is_active,
        created_at,
        company:companies(name)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: users || [],
      total: count || 0,
      limit,
      offset
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Verificar autenticação admin
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, message: 'Não autorizado' }, { status: 401 });
    }

    const serviceSupabase = createServiceClient();

    const { data: adminUser } = await serviceSupabase
      .from('admin_users')
      .select('id')
      .eq('auth_user_id', user.id)
      .eq('is_active', true)
      .single();

    if (!adminUser) {
      return NextResponse.json({ success: false, message: 'Acesso negado' }, { status: 403 });
    }

    const body = await request.json();
    const { name, email, password, company_id, department } = body;

    if (!name || !email || !password || !company_id) {
      return NextResponse.json(
        { success: false, message: 'Campos obrigatórios faltando' },
        { status: 400 }
      );
    }

    // 0. Verificar se email já existe na tabela users
    const { data: existingUser } = await serviceSupabase
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existingUser) {
      return NextResponse.json(
        { success: false, message: 'Este email já está cadastrado no sistema' },
        { status: 409 }
      );
    }

    // 1. Criar usuário no Supabase Auth
    const { data: authData, error: authError } = await serviceSupabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      console.error('Auth error:', authError);
      throw new Error('Erro ao criar usuário: ' + authError.message);
    }

    if (!authData?.user?.id) {
      throw new Error('Erro ao criar usuário: ID não retornado do Auth');
    }

    // 2. Criar/atualizar user na tabela users (upsert para lidar com trigger automático)
    const { data: userData, error: userError } = await serviceSupabase
      .from('users')
      .upsert(
        {
          auth_user_id: authData.user.id,
          user_id: authData.user.id,
          company_id: parseInt(company_id),
          name: name,
          email: email,
          department: department || null,
          role: 'member',
          is_active: true,
        },
        { onConflict: 'email' }
      )
      .select()
      .single();

    if (userError) {
      console.error('User table error:', userError);
      // Tentar deletar usuário do Auth se falhar ao criar na tabela
      try {
        await serviceSupabase.auth.admin.deleteUser(authData.user.id);
      } catch (deleteError) {
        console.error('Failed to rollback auth user:', deleteError);
      }
      throw new Error('Erro ao criar usuário na tabela: ' + userError.message);
    }

    return NextResponse.json({
      success: true,
      message: 'Usuário criado com sucesso!',
      data: userData,
    });
  } catch (error: any) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Erro ao criar usuário' },
      { status: 500 }
    );
  }
}
