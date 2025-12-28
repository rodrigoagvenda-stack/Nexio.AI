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

    const supabase = await createClient();

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

    const supabaseService = await createServiceClient();

    // 1. Buscar nome da empresa primeiro
    const { data: company } = await supabaseService
      .from('companies')
      .select('name')
      .eq('id', companyId)
      .single();

    // 2. Convidar usuário no Supabase Auth (envia email automaticamente)
    const { data: authUser, error: authError } = await supabaseService.auth.admin.inviteUserByEmail(
      email,
      {
        data: {
          name,
          company_id: companyId,
          company_name: company?.name || 'Vend.AI',
          role,
          department: department || null,
        },
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback`,
      }
    );

    if (authError) throw authError;

    // 3. Criar registro na tabela users
    const { data: user, error: userError } = await supabaseService
      .from('users')
      .insert({
        user_id: authUser.user.id,
        auth_user_id: authUser.user.id,
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

    // 4. Registrar log
    await supabaseService.from('system_logs').insert({
      company_id: companyId,
      type: 'user_action',
      severity: 'info',
      message: `Novo membro convidado: ${name} (${email})`,
      payload: {
        user_id: authUser.user.id,
        role,
        invite_sent: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Convite enviado com sucesso! O membro receberá um email para definir sua senha.',
      data: user,
      emailSent: true,
    });
  } catch (error: any) {
    console.error('Error creating member:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Erro ao adicionar membro' },
      { status: 500 }
    );
  }
}
