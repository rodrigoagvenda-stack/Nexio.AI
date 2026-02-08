import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    console.log('[MEMBERS GET] Company ID:', companyId);

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

    if (error) {
      console.error('[MEMBERS GET] Error:', error);
      throw error;
    }

    console.log('[MEMBERS GET] Found members:', members?.length || 0);

    return NextResponse.json({
      success: true,
      data: members || [],
      count: members?.length || 0,
    });
  } catch (error: any) {
    console.error('[MEMBERS GET] Fatal error:', error);
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

    // 1. Verificar se o email já existe no Auth
    console.log('[INVITE] Verificando email:', email);
    const { data: existingUsers } = await supabaseService.auth.admin.listUsers();
    const userExists = existingUsers?.users?.find(u => u.email === email);

    if (userExists) {
      console.log('[INVITE] Email já existe no Auth:', email);
      return NextResponse.json(
        {
          success: false,
          message: 'Este email já está cadastrado no sistema. Se foi deletado, aguarde alguns minutos e tente novamente.'
        },
        { status: 400 }
      );
    }

    // 2. Buscar nome da empresa primeiro
    const { data: company } = await supabaseService
      .from('companies')
      .select('name')
      .eq('id', companyId)
      .single();

    console.log('[INVITE] Empresa:', company?.name);

    // 3. Convidar usuário no Supabase Auth (envia email automaticamente)
    console.log('[INVITE] Enviando convite via Supabase Auth para:', email);

    const redirectUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback`;
    console.log('[INVITE] Redirect URL:', redirectUrl);

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
        redirectTo: redirectUrl,
      }
    );

    if (authError) {
      console.error('[INVITE] Erro ao enviar convite:', authError);
      throw new Error(`Erro ao enviar convite: ${authError.message}`);
    }

    console.log('[INVITE] Convite enviado com sucesso! User ID:', authUser.user.id);
    console.log('[INVITE] Email do usuário:', authUser.user.email);
    console.log('[INVITE] Status do email:', authUser.user.email_confirmed_at ? 'Confirmado' : 'Pendente');

    // 4. Criar registro na tabela users
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

    if (userError) {
      console.error('[INVITE] Erro ao criar usuário na tabela:', userError);
      // Se falhar, deletar do Auth para evitar inconsistência
      await supabaseService.auth.admin.deleteUser(authUser.user.id);
      throw userError;
    }

    console.log('[INVITE] Usuário criado na tabela com sucesso');

    // 5. Registrar logs
    await supabaseService.from('system_logs').insert({
      company_id: companyId,
      type: 'user_action',
      severity: 'info',
      message: `Novo membro convidado: ${name} (${email})`,
      payload: {
        user_id: authUser.user.id,
        role,
        invite_sent: true,
        email_confirmed: !!authUser.user.email_confirmed_at,
      },
    });

    // 6. Criar log de atividade para notificações
    const { data: { user: currentUser } } = await supabaseService.auth.getUser();
    if (currentUser) {
      await supabaseService.from('activity_logs').insert({
        user_id: currentUser.id,
        company_id: companyId,
        action: 'member_invited',
        description: `Convidou ${name} para a equipe`,
        metadata: {
          invited_user_id: authUser.user.id,
          invited_user_name: name,
          invited_user_email: email,
          role,
        },
      });
    }

    console.log('[INVITE] ✅ Processo completo! Email de convite foi enviado pelo Supabase.');

    return NextResponse.json({
      success: true,
      message: 'Convite enviado! Verifique o email (inclusive spam) para aceitar o convite.',
      data: user,
      emailSent: true,
      info: {
        smtp_configured: '⚠️ Verifique se o SMTP está configurado no Supabase (Project Settings > Auth > SMTP Settings)',
        check_logs: 'Verifique os logs do Supabase em: Logs > Auth',
      }
    });
  } catch (error: any) {
    console.error('[INVITE] ❌ Erro ao criar membro:', error);

    // Mensagem mais específica baseada no erro
    let errorMessage = error.message || 'Erro ao adicionar membro';

    if (errorMessage.includes('already registered') || errorMessage.includes('already exists')) {
      errorMessage = 'Este email já está cadastrado. Tente outro email ou delete o usuário anterior completamente.';
    }

    return NextResponse.json(
      { success: false, message: errorMessage },
      { status: 500 }
    );
  }
}
