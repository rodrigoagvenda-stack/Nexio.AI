import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, message: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { is_active } = body;

    if (typeof is_active !== 'boolean') {
      return NextResponse.json(
        { success: false, message: 'Campo is_active deve ser boolean' },
        { status: 400 }
      );
    }

    // Buscar company_id do usuário
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('company_id')
      .eq('auth_user_id', user.id)
      .single();

    if (userError || !userData?.company_id) {
      return NextResponse.json(
        { success: false, message: 'Empresa não encontrada' },
        { status: 404 }
      );
    }

    const { data, error } = await supabase
      .from('companies')
      .update({ is_active })
      .eq('id', userData.company_id)
      .select('id, is_active')
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Error toggling AI:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Erro ao atualizar IA' },
      { status: 500 }
    );
  }
}
