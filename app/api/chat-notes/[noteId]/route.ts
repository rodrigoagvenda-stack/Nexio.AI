import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// PATCH - Update a note
export async function PATCH(
  request: NextRequest,
  { params }: { params: { noteId: string } }
) {
  try {
    const { noteId } = params;
    const body = await request.json();
    const { companyId, noteText, isPinned } = body;

    if (!companyId) {
      return NextResponse.json(
        { success: false, message: 'companyId é obrigatório' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const updateData: any = {};
    if (noteText !== undefined) updateData.note_text = noteText;
    if (isPinned !== undefined) updateData.is_pinned = isPinned;

    const { data, error } = await supabase
      .from('chat_notes')
      .update(updateData)
      .eq('id', noteId)
      .eq('company_id', companyId) // 🔒 Security
      .select(`
        *,
        user:users!chat_notes_user_id_fkey (
          name,
          email
        )
      `)
      .single();

    if (error) throw error;

    if (!data) {
      return NextResponse.json(
        { success: false, message: 'Nota não encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Nota atualizada com sucesso',
      data,
    });
  } catch (error: any) {
    console.error('Error updating chat note:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Erro ao atualizar nota' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a note
export async function DELETE(
  request: NextRequest,
  { params }: { params: { noteId: string } }
) {
  try {
    const { noteId } = params;
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    if (!companyId) {
      return NextResponse.json(
        { success: false, message: 'companyId é obrigatório' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { error } = await supabase
      .from('chat_notes')
      .delete()
      .eq('id', noteId)
      .eq('company_id', companyId); // 🔒 Security

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'Nota deletada com sucesso',
    });
  } catch (error: any) {
    console.error('Error deleting chat note:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Erro ao deletar nota' },
      { status: 500 }
    );
  }
}
