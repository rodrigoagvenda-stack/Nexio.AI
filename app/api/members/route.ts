import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/require-auth';

export async function GET(request: NextRequest) {
  const { context, error: authError } = await requireAuth(request);
  if (authError) return authError;

  try {
    const supabase = await createClient();

    const { data: members, error } = await supabase
      .from('users')
      .select('user_id, name, email, role, department, is_active, last_login, created_at')
      .eq('company_id', context.companyId)
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
  const { context, error: authError } = await requireAuth(request);
  if (authError) return authError;

  // Apenas admin pode convidar membros
  if (context.role !== 'admin' && context.role !== 'manager' && context.role !== 'company_admin') {
    return NextResponse.json({ success: false, message: 'Apenas administradores podem convidar membros' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { name, email, role, department } = body;
    const companyId = context.companyId;

    if (!name || !email || !role) {
      return NextResponse.json(
        { success: false, message: 'Dados obrigatórios faltando' },
        { status: 400 }
      );
    }

    const supabaseService = await createServiceClient();

    // 0. Verificar limite de atendentes do plano
    // trial = acesso completo (período gratuito), scale/undefined = ilimitado
    const ATTENDANT_LIMITS: Record<string, number> = { basic: 1, starter: 3, pro: 10 };
    const { data: companyPlan } = await supabaseService
      .from('companies')
      .select('plan_type')
      .eq('id', companyId)
      .single();
    const planType = companyPlan?.plan_type ?? 'basic';
    const limit = ATTENDANT_LIMITS[planType]; // undefined = scale = unlimited
    if (limit !== undefined) {
      const { count: currentCount } = await supabaseService
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('is_active', true);
      if ((currentCount ?? 0) >= limit) {
        return NextResponse.json(
          { success: false, message: `Seu plano ${planType} permite até ${limit} atendentes. Faça upgrade para adicionar mais.` },
          { status: 403 }
        );
      }
    }

    // 1. Verificar se o email já existe em qualquer empresa
    const { data: existingMembers } = await supabaseService
      .from('users')
      .select('id, company_id')
      .eq('email', email)
      .limit(1);

    if (existingMembers && existingMembers.length > 0) {
      const msg = existingMembers[0].company_id === companyId
        ? 'Este email já é membro desta empresa.'
        : 'Este email já possui uma conta na plataforma.';
      return NextResponse.json({ success: false, message: msg }, { status: 400 });
    }

    // 2. Buscar nome da empresa primeiro
    const { data: company } = await supabaseService
      .from('companies')
      .select('name')
      .eq('id', companyId)
      .single();

    console.log('[INVITE] Empresa:', company?.name);

    // 3. Gerar link de convite via Supabase Admin (não precisa de SMTP)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.zaapply.com.br'
    const redirectUrl = `${appUrl}/api/auth/callback`

    const { data: linkData, error: authError } = await supabaseService.auth.admin.generateLink({
      type: 'invite',
      email,
      options: {
        data: {
          name,
          company_id: companyId,
          company_name: company?.name || 'Zaapply',
          role,
          department: department || null,
        },
        redirectTo: redirectUrl,
      },
    })

    if (authError) {
      console.error('[INVITE] Erro ao gerar link de convite:', authError)
      const msg = authError.message || ''
      if (msg.includes('already registered') || msg.includes('already exists') || msg.includes('already been registered')) {
        return NextResponse.json({ success: false, message: 'Este email já possui uma conta. Verifique a caixa de entrada do convidado.' }, { status: 400 })
      }
      return NextResponse.json({ success: false, message: `Erro ao criar convite: ${msg}` }, { status: 500 })
    }

    const authUser = linkData.user
    const inviteUrl = linkData.properties?.action_link ?? redirectUrl
    console.log('[INVITE] Link gerado para:', email, '| User ID:', authUser.id)

    // 3b. Enviar email via Resend
    const { sendMemberInviteEmail } = await import('@/lib/email/resend')
    const emailResult = await sendMemberInviteEmail({
      to: email,
      name,
      companyName: company?.name || 'Zaapply',
      role,
      inviteUrl,
    })
    if (!emailResult.success) {
      console.warn('[INVITE] Falha ao enviar email via Resend:', emailResult.message)
    } else {
      console.log('[INVITE] Email enviado via Resend com sucesso')
    }

    // 4. Completar o registro na tabela users : o trigger on_auth_user_created
    // (handle_new_user) já cria uma linha básica (auth_user_id, name, email)
    // assim que o usuário é criado no Auth, um passo antes deste. Um INSERT
    // aqui sempre colidiria com ela (era a causa real do erro "email já
    // possui conta" em todo convite); upsert por auth_user_id completa essa
    // mesma linha com os dados que o trigger não preenche (user_id,
    // company_id, role, department).
    const { data: user, error: userError } = await supabaseService
      .from('users')
      .upsert({
        auth_user_id: authUser.id,
        user_id: authUser.id,
        company_id: companyId,
        name,
        email,
        role,
        department: department || null,
        is_active: true,
      }, { onConflict: 'auth_user_id' })
      .select()
      .single();

    if (userError) {
      console.error('[INVITE] Erro ao criar usuário na tabela:', JSON.stringify(userError));
      // Se falhar, deletar do Auth para evitar inconsistência
      await supabaseService.auth.admin.deleteUser(authUser.id);

      // Só é "email já tem conta" de verdade se a violação foi especificamente
      // na constraint de email (23505 = unique_violation no Postgres). Qualquer
      // outro erro (FK, check, RLS, coluna obrigatória faltando etc.) mostra a
      // mensagem real em vez de mentir pro usuário que a conta já existe.
      if (userError.code === '23505' && userError.message?.includes('users_email_key')) {
        return NextResponse.json(
          { success: false, message: 'Este email já possui uma conta na plataforma.' },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { success: false, message: `Erro ao criar membro: ${userError.message}` },
        { status: 500 }
      );
    }

    console.log('[INVITE] Usuário criado na tabela com sucesso');

    // 5. Logs : fire-and-forget, não bloqueia o retorno
    supabaseService.from('system_logs').insert({
      company_id: companyId,
      type: 'user_action',
      severity: 'info',
      message: `Novo membro convidado: ${name} (${email})`,
      payload: { user_id: authUser.id, role, invite_sent: true },
    }).then(undefined, () => {});

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
    const errorMessage = error.message || 'Erro ao adicionar membro';

    if (
      errorMessage.includes('already registered') ||
      errorMessage.includes('already exists') ||
      errorMessage.includes('users_email_key') ||
      errorMessage.includes('duplicate key')
    ) {
      return NextResponse.json(
        { success: false, message: 'Este email já possui uma conta na plataforma.' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: false, message: errorMessage }, { status: 500 });
  }
}
