import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// PATCH - Update a tag
export async function PATCH(
  request: NextRequest,
  { params }: { params: { tagId: string } }
) {
  try {
    const { tagId } = params;
    const body = await request.json();
    const { companyId, tagName, tagColor } = body;

    if (!companyId) {
      return NextResponse.json(
        { success: false, message: 'companyId é obrigatório' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const updateData: any = {};
    if (tagName !== undefined) updateData.tag_name = tagName;
    if (tagColor !== undefined) updateData.tag_color = tagColor;

    const { data, error } = await supabase
      .from('tags')
      .update(updateData)
      .eq('id', tagId)
      .eq('company_id', companyId) // 🔒 Security
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { success: false, message: 'Já existe uma tag com este nome' },
          { status: 400 }
        );
      }
      throw error;
    }

    if (!data) {
      return NextResponse.json(
        { success: false, message: 'Tag não encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Tag atualizada com sucesso',
      data,
    });
  } catch (error: any) {
    console.error('Error updating tag:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Erro ao atualizar tag' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a tag
export async function DELETE(
  request: NextRequest,
  { params }: { params: { tagId: string } }
) {
  try {
    const { tagId } = params;
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    if (!companyId) {
      return NextResponse.json(
        { success: false, message: 'companyId é obrigatório' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Delete tag (cascade will delete lead_tags automatically)
    const { error } = await supabase
      .from('tags')
      .delete()
      .eq('id', tagId)
      .eq('company_id', companyId); // 🔒 Security

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'Tag deletada com sucesso',
    });
  } catch (error: any) {
    console.error('Error deleting tag:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Erro ao deletar tag' },
      { status: 500 }
    );
  }
}
