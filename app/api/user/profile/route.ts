import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

// users tem RLS só de SELECT (sem policy de UPDATE pra authenticated), então
// update direto do browser client (createClient()) não erra mas também não
// grava nada : mesmo caso já visto em activity_logs/upload-photo.
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, message: 'Não autorizado' }, { status: 401 });
    }

    const { name, description, department } = await request.json();
    if (typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ success: false, message: 'Nome é obrigatório' }, { status: 400 });
    }

    const service = createServiceClient();
    const { error } = await service
      .from('users')
      .update({ name: name.trim(), description: description ?? null, department: department ?? null })
      .eq('auth_user_id', user.id);

    if (error) {
      console.error('[user/profile] update error:', error);
      return NextResponse.json({ success: false, message: 'Erro ao salvar perfil' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[user/profile] error:', error);
    return NextResponse.json({ success: false, message: error.message || 'Erro interno' }, { status: 500 });
  }
}
