import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await request.json();
    const { role, department, companyId } = body;
    const { id: userId } = await params;

    if (!userId || !companyId) {
      return NextResponse.json(
        { success: false, message: 'Dados obrigatórios faltando' },
        { status: 400 }
      );
    }

    const supabase = await createServiceClient();

    // Atualizar membro
    const { data: updatedUser, error } = await supabase
      .from('users')
      .update({
        role: role || undefined,
        department: department || null,
      })
      .eq('user_id', userId)
      .eq('company_id', companyId)
      .select()
      .single();

    if (error) throw error;

    // Registrar logs
    await supabase.from('system_logs').insert({
      company_id: companyId,
      type: 'user_action',
      severity: 'info',
      message: `Membro atualizado: ${updatedUser.name}`,
      metadata: {
        user_id: userId,
        changes: { role, department },
      },
    });

    // Criar log de atividade para notificações
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (currentUser) {
      await supabase.from('activity_logs').insert({
        user_id: currentUser.id,
        company_id: companyId,
        action: 'member_updated',
        description: `Atualizou informações de ${updatedUser.name}`,
        metadata: {
          updated_user_id: userId,
          updated_user_name: updatedUser.name,
          changes: { role, department },
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Membro atualizado com sucesso',
      data: updatedUser,
    });
  } catch (error: any) {
    console.error('Error updating member:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await request.json();
    const { companyId } = body;
    const { id: userId } = await params;

    if (!userId || !companyId) {
      return NextResponse.json(
        { success: false, message: 'Dados obrigatórios faltando' },
        { status: 400 }
      );
    }

    const supabase = await createServiceClient();

    // Buscar info do usuário antes de deletar
    const { data: user } = await supabase
      .from('users')
      .select('name, email')
      .eq('user_id', userId)
      .eq('company_id', companyId)
      .single();

    // 1. Deletar do Supabase Auth PRIMEIRO
    const { error: authError } = await supabase.auth.admin.deleteUser(userId);

    if (authError) {
      console.error('Error deleting from Auth:', authError);
      // Continua mesmo se der erro no Auth
    }

    // 2. Deletar da tabela users
    const { error: dbError } = await supabase
      .from('users')
      .delete()
      .eq('user_id', userId)
      .eq('company_id', companyId);

    if (dbError) throw dbError;

    // 3. Registrar logs
    await supabase.from('system_logs').insert({
      company_id: companyId,
      type: 'user_action',
      severity: 'warning',
      message: `Membro deletado: ${user?.name} (${user?.email})`,
      payload: {
        user_id: userId,
        deleted_from_auth: !authError,
      },
    });

    // 4. Criar log de atividade para notificações
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (currentUser) {
      await supabase.from('activity_logs').insert({
        user_id: currentUser.id,
        company_id: companyId,
        action: 'member_removed',
        description: `Removeu ${user?.name} da equipe`,
        metadata: {
          removed_user_id: userId,
          removed_user_name: user?.name,
          removed_user_email: user?.email,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Membro deletado completamente do sistema',
    });
  } catch (error: any) {
    console.error('Error deleting member:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
