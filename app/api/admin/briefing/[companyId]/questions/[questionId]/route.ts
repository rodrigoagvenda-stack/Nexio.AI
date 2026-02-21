import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

async function checkAdmin(supabase: any) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('admin_users').select('id').eq('auth_user_id', user.id).eq('is_active', true).single();
  return data ? user : null;
}

// PATCH: Editar pergunta
export async function PATCH(
  request: NextRequest,
  { params }: { params: { companyId: string; questionId: string } }
) {
  try {
    const supabase = await createClient();
    if (!await checkAdmin(supabase)) {
      return NextResponse.json({ success: false, message: 'Acesso negado' }, { status: 403 });
    }

    const body = await request.json();
    const { label, field_key, question_type, options, is_required, order_index } = body;

    const service = createServiceClient();
    const { data, error } = await service
      .from('briefing_questions')
      .update({ label, field_key, question_type, options, is_required, order_index })
      .eq('id', params.questionId)
      .eq('company_id', params.companyId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// DELETE: Remover pergunta
export async function DELETE(
  request: NextRequest,
  { params }: { params: { companyId: string; questionId: string } }
) {
  try {
    const supabase = await createClient();
    if (!await checkAdmin(supabase)) {
      return NextResponse.json({ success: false, message: 'Acesso negado' }, { status: 403 });
    }

    const service = createServiceClient();
    const { error } = await service
      .from('briefing_questions')
      .delete()
      .eq('id', params.questionId)
      .eq('company_id', params.companyId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
