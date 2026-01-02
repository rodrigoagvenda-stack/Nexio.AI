import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// POST - Assign a tag to a lead
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

    // Verify tag belongs to company (security)
    const { data: tag, error: tagError } = await supabase
      .from('tags')
      .select('*')
      .eq('id', tagId)
      .eq('company_id', companyId)
      .single();

    if (tagError || !tag) {
      return NextResponse.json(
        { success: false, message: 'Tag não encontrada' },
        { status: 404 }
      );
    }

    // Assign tag to lead
    const { data, error } = await supabase
      .from('lead_tags')
      .insert({
        lead_id: leadId,
        tag_id: tagId,
      })
      .select(`
        *,
        tag:tags(*)
      `)
      .single();

    if (error) {
      // Unique constraint violation = tag already assigned
      if (error.code === '23505') {
        return NextResponse.json(
          { success: false, message: 'Tag já está atribuída a este lead' },
          { status: 400 }
        );
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      message: 'Tag atribuída com sucesso',
      data,
    });
  } catch (error: any) {
    console.error('Error assigning tag:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Erro ao atribuir tag' },
      { status: 500 }
    );
  }
}
