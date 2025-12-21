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

    // Registrar log
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

    // Buscar info do usuário antes de desativar
    const { data: user } = await supabase
      .from('users')
      .select('name, email')
      .eq('user_id', userId)
      .eq('company_id', companyId)
      .single();

    // Desativar membro (soft delete)
    const { error } = await supabase
      .from('users')
      .update({ is_active: false })
      .eq('user_id', userId)
      .eq('company_id', companyId);

    if (error) throw error;

    // Desativar no Supabase Auth
    await supabase.auth.admin.updateUserById(userId, {
      user_metadata: { is_active: false },
    });

    // Registrar log
    await supabase.from('system_logs').insert({
      company_id: companyId,
      type: 'user_action',
      severity: 'warning',
      message: `Membro removido: ${user?.name} (${user?.email})`,
      metadata: {
        user_id: userId,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Membro removido com sucesso',
    });
  } catch (error: any) {
    console.error('Error deleting member:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
