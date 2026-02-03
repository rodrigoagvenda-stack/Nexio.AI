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

    // Buscar empresas
    let query = supabase.from('companies').select('*').order('created_at', { ascending: false });

    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: data || [],
    });
  } catch (error: any) {
    console.error('Error fetching companies:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Erro ao buscar empresas' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const serviceSupabase = createServiceClient();
  let createdAuthUserId: string | null = null;
  let createdCompanyId: number | null = null;

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
    const { name, email, phone, plan_type, whatsapp_instance, whatsapp_token } = body;

    if (!name || !email || !plan_type) {
      return NextResponse.json(
        { success: false, message: 'Campos obrigatórios faltando' },
        { status: 400 }
      );
    }

    // Verificar se email já existe na tabela companies
    const { data: existingCompany } = await serviceSupabase
      .from('companies')
      .select('id')
      .eq('email', email)
      .single();

    if (existingCompany) {
      return NextResponse.json(
        { success: false, message: 'Já existe uma empresa com este email' },
        { status: 400 }
      );
    }

    // Verificar se email já existe na tabela users
    const { data: existingUser } = await serviceSupabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      return NextResponse.json(
        { success: false, message: 'Já existe um usuário com este email' },
        { status: 400 }
      );
    }

    // 1. Criar usuário no Supabase Auth
    const tempPassword = 'Vendai@2025'; // Senha temporária
    const { data: authData, error: authError } = await serviceSupabase.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
    });

    if (authError) {
      console.error('Auth error:', authError);
      return NextResponse.json(
        { success: false, message: 'Email já cadastrado no sistema de autenticação' },
        { status: 400 }
      );
    }

    createdAuthUserId = authData.user.id;

    // 2. Criar company
    const { data: companyData, error: companyError } = await serviceSupabase
      .from('companies')
      .insert([
        {
          name,
          email,
          phone,
          plan_type,
          whatsapp_instance,
          whatsapp_token,
          is_active: true,
        },
      ])
      .select()
      .single();

    if (companyError) {
      // Rollback: deletar auth user criado
      if (createdAuthUserId) {
        await serviceSupabase.auth.admin.deleteUser(createdAuthUserId);
      }
      console.error('Company error:', companyError);
      return NextResponse.json(
        { success: false, message: 'Erro ao criar empresa: ' + companyError.message },
        { status: 500 }
      );
    }

    createdCompanyId = companyData.id;

    // 3. Criar user na tabela users
    const { data: userData, error: userError } = await serviceSupabase
      .from('users')
      .insert([
        {
          auth_user_id: authData.user.id,
          user_id: authData.user.id,
          company_id: companyData.id,
          name: name,
          email: email,
          is_active: true,
        },
      ])
      .select()
      .single();

    if (userError) {
      // Rollback: deletar company e auth user
      if (createdCompanyId) {
        await serviceSupabase.from('companies').delete().eq('id', createdCompanyId);
      }
      if (createdAuthUserId) {
        await serviceSupabase.auth.admin.deleteUser(createdAuthUserId);
      }
      console.error('User error:', userError);
      return NextResponse.json(
        { success: false, message: 'Erro ao criar usuário: ' + userError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Empresa criada com sucesso!',
      data: companyData,
    });
  } catch (error: any) {
    // Rollback em caso de erro inesperado
    if (createdCompanyId) {
      await serviceSupabase.from('companies').delete().eq('id', createdCompanyId);
    }
    if (createdAuthUserId) {
      await serviceSupabase.auth.admin.deleteUser(createdAuthUserId);
    }
    console.error('Error creating company:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Erro ao criar empresa' },
      { status: 500 }
    );
  }
}
