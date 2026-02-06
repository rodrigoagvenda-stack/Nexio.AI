import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Buscar o usuário para pegar o auth_user_id
    const { data: userToDelete, error: fetchError } = await supabase
      .from('users')
      .select('auth_user_id')
      .eq('id', params.id)
      .single();

    if (fetchError || !userToDelete) {
      throw new Error('Usuário não encontrado');
    }

    const serviceSupabase = createServiceClient();

    // 1. Deletar da tabela users
    const { error: deleteUserError } = await serviceSupabase
      .from('users')
      .delete()
      .eq('id', params.id);

    if (deleteUserError) throw deleteUserError;

    // 2. Deletar do Supabase Auth (se tiver auth_user_id)
    if (userToDelete.auth_user_id) {
      const { error: deleteAuthError } = await serviceSupabase.auth.admin.deleteUser(
        userToDelete.auth_user_id
      );

      if (deleteAuthError) {
        console.error('Error deleting auth user:', deleteAuthError);
        // Continuar mesmo se der erro, pois o user já foi deletado da tabela
      }
    }

    return NextResponse.json({ success: true, message: 'Usuário deletado' });
  } catch (error: any) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
