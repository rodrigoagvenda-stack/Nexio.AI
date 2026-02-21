import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

async function checkAdmin(supabase: any) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('admin_users').select('id').eq('auth_user_id', user.id).eq('is_active', true).single();
  return data ? user : null;
}

// GET: Listar perguntas da empresa
export async function GET(
  request: NextRequest,
  { params }: { params: { companyId: string } }
) {
  try {
    const supabase = await createClient();
    if (!await checkAdmin(supabase)) {
      return NextResponse.json({ success: false, message: 'Acesso negado' }, { status: 403 });
    }

    const service = createServiceClient();
    const { data, error } = await service
      .from('briefing_questions')
      .select('*')
      .eq('company_id', params.companyId)
      .order('order_index', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ success: true, data: data || [] });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// POST: Criar nova pergunta
export async function POST(
  request: NextRequest,
  { params }: { params: { companyId: string } }
) {
  try {
    const supabase = await createClient();
    if (!await checkAdmin(supabase)) {
      return NextResponse.json({ success: false, message: 'Acesso negado' }, { status: 403 });
    }

    const body = await request.json();
    const { label, field_key, question_type, options, is_required, order_index } = body;
    const companyId = parseInt(params.companyId);

    if (!label || !field_key || !question_type) {
      return NextResponse.json({ success: false, message: 'Campos obrigatórios faltando' }, { status: 400 });
    }

    const service = createServiceClient();
    const { data, error } = await service
      .from('briefing_questions')
      .insert({
        company_id: companyId,
        label,
        field_key,
        question_type,
        options: options || null,
        is_required: is_required ?? false,
        order_index: order_index ?? 0,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// PATCH: Reordenar perguntas (recebe array de { id, order_index })
export async function PATCH(
  request: NextRequest,
  { params }: { params: { companyId: string } }
) {
  try {
    const supabase = await createClient();
    if (!await checkAdmin(supabase)) {
      return NextResponse.json({ success: false, message: 'Acesso negado' }, { status: 403 });
    }

    const body = await request.json();
    const { questions } = body; // [{ id, order_index }]

    if (!Array.isArray(questions)) {
      return NextResponse.json({ success: false, message: 'Formato inválido' }, { status: 400 });
    }

    const service = createServiceClient();
    await Promise.all(
      questions.map(({ id, order_index }: { id: number; order_index: number }) =>
        service.from('briefing_questions').update({ order_index }).eq('id', id).eq('company_id', params.companyId)
      )
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
