import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/require-auth';
import { isPrivilegedRole, isValidMemberRole } from '@/lib/auth/member-roles';

type ServiceClient = ReturnType<typeof createServiceClient>;

// Quantos administradores ativos a empresa tem, sem contar o membro indicado
async function otherActiveAdmins(supabase: ServiceClient, companyId: number, exceptUserId: string) {
  const { count } = await supabase
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('is_active', true)
    .in('role', ['admin', 'company_admin'])
    .neq('user_id', exceptUserId);
  return count ?? 0;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { context, error: authError } = await requireAuth(request);
  if (authError) return authError;

  if (context.role !== 'admin' && context.role !== 'manager' && context.role !== 'company_admin') {
    return NextResponse.json({ success: false, message: 'Apenas administradores podem atualizar membros' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { role, department } = body;
    const { id: userId } = await params;

    const supabase = createServiceClient();

    const { data: target } = await supabase
      .from('users')
      .select('user_id, name, role')
      .eq('user_id', userId)
      .eq('company_id', context.companyId)
      .maybeSingle();

    if (!target) {
      return NextResponse.json({ success: false, message: 'Membro não encontrado' }, { status: 404 });
    }

    const callerIsPrivileged = isPrivilegedRole(context.role);

    // Gerente só mexe em quem não é administrador e não dá papel de administrador
    if (!callerIsPrivileged) {
      if (isPrivilegedRole(target.role)) {
        return NextResponse.json({ success: false, message: 'Apenas administradores podem alterar outro administrador' }, { status: 403 });
      }
      if (isPrivilegedRole(role)) {
        return NextResponse.json({ success: false, message: 'Apenas administradores podem dar o papel de administrador' }, { status: 403 });
      }
    }

    const update: Record<string, unknown> = {};

    if (role !== undefined && role !== null && role !== '') {
      if (!isValidMemberRole(role)) {
        return NextResponse.json({ success: false, message: 'Papel inválido' }, { status: 400 });
      }
      // A empresa nunca pode ficar sem administrador
      if (isPrivilegedRole(target.role) && !isPrivilegedRole(role)) {
        if ((await otherActiveAdmins(supabase, context.companyId, userId)) === 0) {
          return NextResponse.json({ success: false, message: 'A empresa precisa de pelo menos um administrador' }, { status: 400 });
        }
      }
      update.role = role;
    }

    // Só grava o departamento se ele veio no corpo: editar só a função não apaga mais o departamento
    if (department !== undefined) {
      update.department = department || null;
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ success: false, message: 'Nada para atualizar' }, { status: 400 });
    }

    const { data: updatedUser, error } = await supabase
      .from('users')
      .update(update)
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
      metadata: { user_id: userId, changes: update },
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

  if (context.role !== 'admin' && context.role !== 'manager' && context.role !== 'company_admin') {
    return NextResponse.json({ success: false, message: 'Apenas administradores podem remover membros' }, { status: 403 });
  }

  try {
    const { id: userId } = await params;
    const supabase = createServiceClient();

    if (userId === context.userId) {
      return NextResponse.json({ success: false, message: 'Você não pode remover a si mesmo' }, { status: 400 });
    }

    // Antes de tocar no Auth: o membro precisa ser DESTA empresa. Sem essa checagem,
    // qualquer admin apagava a conta de login de outra empresa só sabendo o id.
    const { data: user } = await supabase
      .from('users')
      .select('name, email, role')
      .eq('user_id', userId)
      .eq('company_id', context.companyId)
      .maybeSingle();

    if (!user) {
      return NextResponse.json({ success: false, message: 'Membro não encontrado' }, { status: 404 });
    }

    if (!isPrivilegedRole(context.role) && isPrivilegedRole(user.role)) {
      return NextResponse.json({ success: false, message: 'Apenas administradores podem remover outro administrador' }, { status: 403 });
    }

    if (isPrivilegedRole(user.role) && (await otherActiveAdmins(supabase, context.companyId, userId)) === 0) {
      return NextResponse.json({ success: false, message: 'A empresa precisa de pelo menos um administrador' }, { status: 400 });
    }

    const { error: authDeleteError } = await supabase.auth.admin.deleteUser(userId);
    if (authDeleteError && !/not.?found/i.test(authDeleteError.message ?? '')) {
      throw authDeleteError;
    }

    const { error: dbError } = await supabase.from('users').delete().eq('user_id', userId).eq('company_id', context.companyId);
    if (dbError) throw dbError;

    await supabase.from('system_logs').insert({
      company_id: context.companyId,
      type: 'user_action',
      severity: 'warning',
      message: `Membro deletado: ${user.name} (${user.email})`,
      metadata: { user_id: userId },
    });

    return NextResponse.json({ success: true, message: 'Membro deletado com sucesso' });
  } catch (error: any) {
    console.error('Error deleting member:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
