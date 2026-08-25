import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, message: 'Não autorizado' }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from('users')
      .select('company_id')
      .eq('auth_user_id', user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ success: false, message: 'Empresa não encontrada' }, { status: 403 });
    }

    const serviceSupabase = createServiceClient();
    const { data, error } = await serviceSupabase
      .from('outbound_limits')
      .select('*')
      .eq('company_id', userData.company_id)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) throw error;

    return NextResponse.json({ success: true, limits: data?.[0] ?? null });
  } catch (error: any) {
    console.error('outbound limits GET error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, message: 'Não autorizado' }, { status: 401 });
    }

    // company_id sempre do usuário autenticado : nunca do body (previne IDOR)
    const { data: userData } = await supabase
      .from('users')
      .select('company_id, role')
      .eq('auth_user_id', user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ success: false, message: 'Empresa não encontrada' }, { status: 403 });
    }

    if (!['admin', 'company_admin', 'manager'].includes(userData.role ?? '')) {
      return NextResponse.json({ success: false, message: 'Apenas administradores podem alterar limites' }, { status: 403 });
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
