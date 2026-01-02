import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// POST - Remove a tag from a lead
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { leadId, tagId, companyId } = body;

    if (!leadId || !tagId || !companyId) {
      return NextResponse.json(
        { success: false, message: 'Dados obrigatórios faltando' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Verify lead belongs to company (security)
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('id')
      .eq('id', leadId)
      .eq('company_id', companyId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json(
        { success: false, message: 'Lead não encontrado' },
        { status: 404 }
      );
    }

    // Remove tag assignment
    const { error } = await supabase
      .from('lead_tags')
      .delete()
      .eq('lead_id', leadId)
      .eq('tag_id', tagId);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'Tag removida com sucesso',
    });
  } catch (error: any) {
    console.error('Error removing tag:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Erro ao remover tag' },
      { status: 500 }
    );
  }
}
