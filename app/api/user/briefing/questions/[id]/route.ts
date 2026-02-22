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

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const companyId = await getCompanyId();
    if (!companyId) return NextResponse.json({ success: false, message: 'Não autorizado' }, { status: 401 });

    const body = await request.json();
    const { label, field_key, question_type, options, is_required, order_index } = body;

    const service = createServiceClient();
    const { data, error } = await service
      .from('briefing_questions')
      .update({ label, field_key, question_type, options: options || null, is_required, order_index })
      .eq('id', params.id)
      .eq('company_id', companyId)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const companyId = await getCompanyId();
    if (!companyId) return NextResponse.json({ success: false, message: 'Não autorizado' }, { status: 401 });

    const service = createServiceClient();
    const { error } = await service
      .from('briefing_questions')
      .delete()
      .eq('id', params.id)
      .eq('company_id', companyId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
