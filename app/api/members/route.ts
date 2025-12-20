import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    if (!companyId) {
      return NextResponse.json(
        { success: false, message: 'Company ID é obrigatório' },
        { status: 400 }
      );
    }

    const supabase = createClient();

    const { data: members, error } = await supabase
      .from('users')
      .select('user_id, name, email, role, department, is_active, last_login, created_at')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: members,
    });
  } catch (error: any) {
    console.error('Error fetching members:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, role, department, companyId } = body;

    if (!name || !email || !role || !companyId) {
      return NextResponse.json(
        { success: false, message: 'Dados obrigatórios faltando' },
        { status: 400 }
      );
    }

    const supabaseService = createServiceClient();

    // 1. Criar usuário no Supabase Auth
    const { data: authUser, error: authError } = await supabaseService.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        name,
        company_id: companyId,
      },
    });

    if (authError) throw authError;

    // 2. Criar registro na tabela users
    const { data: user, error: userError } = await supabaseService
      .from('users')
      .insert({
        user_id: authUser.user.id,
        company_id: companyId,
        name,
        email,
        role,
        department: department || null,
        is_active: true,
      })
      .select()
      .single();

    if (userError) throw userError;

    // 3. Registrar log
    await supabaseService.from('system_logs').insert({
      company_id: companyId,
      type: 'user_action',
      severity: 'info',
      message: `Novo membro adicionado: ${name} (${email})`,
      metadata: {
        user_id: authUser.user.id,
        role,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Membro adicionado com sucesso',
      data: user,
    });
  } catch (error: any) {
    console.error('Error creating member:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Erro ao adicionar membro' },
      { status: 500 }
    );
  }
}
