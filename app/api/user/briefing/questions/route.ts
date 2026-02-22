import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

async function getCompanyId() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from('users')
    .select('company_id')
    .eq('auth_user_id', user.id)
    .single();
  return data?.company_id ?? null;
}

export async function GET() {
  try {
    const companyId = await getCompanyId();
    if (!companyId) return NextResponse.json({ success: false, message: 'Não autorizado' }, { status: 401 });

    const service = createServiceClient();
    const { data, error } = await service
      .from('briefing_questions')
      .select('*')
      .eq('company_id', companyId)
      .order('order_index', { ascending: true });

    if (error) throw error;
    return NextResponse.json({ success: true, data: data || [] });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const companyId = await getCompanyId();
    if (!companyId) return NextResponse.json({ success: false, message: 'Não autorizado' }, { status: 401 });

    const body = await request.json();
    const { label, field_key, question_type, options, is_required, order_index } = body;

    if (!label || !field_key || !question_type) {
      return NextResponse.json({ success: false, message: 'Campos obrigatórios faltando' }, { status: 400 });
    }

    const service = createServiceClient();
    const { data, error } = await service
      .from('briefing_questions')
      .insert({ company_id: companyId, label, field_key, question_type, options: options || null, is_required: is_required ?? false, order_index: order_index ?? 0 })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
