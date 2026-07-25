import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, message: 'Não autorizado' }, { status: 401 });
    }

    // company_id sempre do usuário autenticado — nunca do body (previne IDOR)
    const { data: userData } = await supabase
      .from('users')
      .select('company_id')
      .eq('auth_user_id', user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ success: false, message: 'Empresa não encontrada' }, { status: 403 });
    }

    const body = await request.json();
    const { limite_diario } = body;

    const serviceSupabase = createServiceClient();
    const { error: updateError } = await serviceSupabase
      .from('outbound_limits')
      .update({ limite_diario })
      .eq('company_id', userData.company_id);

    if (updateError) throw updateError;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('outbound limits error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
