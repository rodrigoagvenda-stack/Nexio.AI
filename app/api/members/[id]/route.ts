import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/require-auth';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { context, error: authError } = await requireAuth(request);
  if (authError) return authError;

  if (context.role !== 'company_admin') {
    return NextResponse.json({ success: false, message: 'Apenas administradores podem atualizar membros' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { role, department } = body;
    const { id: userId } = await params;

    const supabase = createServiceClient();

    const { data: updatedUser, error } = await supabase
      .from('users')
      .update({ role: role || undefined, department: department || null })
      .eq('user_id', userId)
      .eq('company_id', context.companyId)
      .select()
      .single();

    if (error) throw error;

    await supabase.from('system_logs').insert({
      company_id: context.companyId,
      type: 'user_action',
      severity: 'info',
      message: `Membro atualizado: ${updatedUser.name}`,
      metadata: { user_id: userId, changes: { role, department } },
    });

    return NextResponse.json({ success: true, message: 'Membro atualizado com sucesso', data: updatedUser });
  } catch (error: any) {
    console.error('Error updating member:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { context, error: authError } = await requireAuth(request);
  if (authError) return authError;

  if (context.role !== 'company_admin') {
    return NextResponse.json({ success: false, message: 'Apenas administradores podem remover membros' }, { status: 403 });
  }

  try {
    const { id: userId } = await params;
    const supabase = createServiceClient();

    const { data: user } = await supabase.from('users').select('name, email').eq('user_id', userId).eq('company_id', context.companyId).single();

    await supabase.auth.admin.deleteUser(userId);

    const { error: dbError } = await supabase.from('users').delete().eq('user_id', userId).eq('company_id', context.companyId);
    if (dbError) throw dbError;

    await supabase.from('system_logs').insert({
      company_id: context.companyId,
      type: 'user_action',
      severity: 'warning',
      message: `Membro deletado: ${user?.name} (${user?.email})`,
      metadata: { user_id: userId },
    });

    return NextResponse.json({ success: true, message: 'Membro deletado com sucesso' });
  } catch (error: any) {
    console.error('Error deleting member:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
