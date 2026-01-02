import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET - List all tags for a company
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    if (!companyId) {
      return NextResponse.json(
        { success: false, message: 'companyId é obrigatório' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('tags')
      .select('*')
      .eq('company_id', companyId)
      .order('tag_name', { ascending: true });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: data || [],
    });
  } catch (error: any) {
    console.error('Error fetching tags:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Erro ao buscar tags' },
      { status: 500 }
    );
  }
}

// POST - Create a new tag
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId, tagName, tagColor } = body;

    if (!companyId || !tagName) {
      return NextResponse.json(
        { success: false, message: 'Dados obrigatórios faltando' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('tags')
      .insert({
        company_id: companyId,
        tag_name: tagName,
        tag_color: tagColor || '#6366f1', // Default indigo color
      })
      .select()
      .single();

    if (error) {
      // Check for unique constraint violation
      if (error.code === '23505') {
        return NextResponse.json(
          { success: false, message: 'Esta tag já existe' },
          { status: 400 }
        );
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      message: 'Tag criada com sucesso',
      data,
    });
  } catch (error: any) {
    console.error('Error creating tag:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Erro ao criar tag' },
      { status: 500 }
    );
  }
}
