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

    // Usar service client para bypassar RLS e ver todas as empresas
    const serviceSupabase = createServiceClient();

    // Buscar parâmetros de query
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';

    // Buscar empresas (usando service client para admin ver todas)
    let query = serviceSupabase.from('companies').select('*').order('created_at', { ascending: false });

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

    // Usar service client para criar company
    const serviceSupabase = createServiceClient();

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

    // Criar apenas a empresa (usuários são criados na seção de Usuários)
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
      console.error('Company error:', companyError);
      return NextResponse.json(
        { success: false, message: 'Erro ao criar empresa: ' + companyError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Empresa criada com sucesso!',
      data: companyData,
    });
  } catch (error: any) {
    console.error('Error creating company:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Erro ao criar empresa' },
      { status: 500 }
    );
  }
}
