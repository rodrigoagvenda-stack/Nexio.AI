import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/require-auth';

export async function POST(request: NextRequest) {
  const { context, error: authError } = await requireAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { leadId, tagId } = body;

    if (!leadId || !tagId) {
      return NextResponse.json({ success: false, message: 'Dados obrigatórios faltando' }, { status: 400 });
    }

    const supabase = await createClient();

    const [{ data: lead, error: leadError }, { data: tag, error: tagError }] = await Promise.all([
      supabase.from('leads').select('id').eq('id', leadId).eq('company_id', context.companyId).single(),
      supabase.from('tags').select('*').eq('id', tagId).eq('company_id', context.companyId).single(),
    ]);

    if (leadError || !lead) return NextResponse.json({ success: false, message: 'Lead não encontrado' }, { status: 404 });
    if (tagError || !tag) return NextResponse.json({ success: false, message: 'Tag não encontrada' }, { status: 404 });

    const { data, error } = await supabase.from('lead_tags').insert({ lead_id: leadId, tag_id: tagId }).select('*, tag:tags(*)').single();

    if (error) {
      if (error.code === '23505') return NextResponse.json({ success: false, message: 'Tag já está atribuída a este lead' }, { status: 400 });
      throw error;
    }

    return NextResponse.json({ success: true, message: 'Tag atribuída com sucesso', data });
  } catch (error: any) {
    console.error('Error assigning tag:', error);
    return NextResponse.json({ success: false, message: error.message || 'Erro ao atribuir tag' }, { status: 500 });
  }
}
