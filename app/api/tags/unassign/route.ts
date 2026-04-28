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

    const { data: lead, error: leadError } = await supabase.from('leads').select('id').eq('id', leadId).eq('company_id', context.companyId).single();
    if (leadError || !lead) return NextResponse.json({ success: false, message: 'Lead não encontrado' }, { status: 404 });

    const { error } = await supabase.from('lead_tags').delete().eq('lead_id', leadId).eq('tag_id', tagId);
    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Tag removida com sucesso' });
  } catch (error: any) {
    console.error('Error removing tag:', error);
    return NextResponse.json({ success: false, message: error.message || 'Erro ao remover tag' }, { status: 500 });
  }
}
