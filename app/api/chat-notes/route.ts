import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET - List notes for a lead or conversation
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const leadId = searchParams.get('leadId');
    const conversationId = searchParams.get('conversationId');

    if (!companyId) {
      return NextResponse.json(
        { success: false, message: 'companyId é obrigatório' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    let query = supabase
      .from('chat_notes')
      .select(`
        *,
        user:users!chat_notes_user_id_fkey (
          name,
          email
        )
      `)
      .eq('company_id', companyId)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false });

    // Filter by lead or conversation
    if (leadId) {
      query = query.eq('lead_id', leadId);
    } else if (conversationId) {
      query = query.eq('conversation_id', conversationId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: data || [],
    });
  } catch (error: any) {
    console.error('Error fetching chat notes:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Erro ao buscar notas' },
      { status: 500 }
    );
  }
}

// POST - Create a new note
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId, leadId, conversationId, userId, noteText, isPinned } = body;

    if (!companyId || !userId || !noteText) {
      return NextResponse.json(
        { success: false, message: 'Dados obrigatórios faltando' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('chat_notes')
      .insert({
        company_id: companyId,
        lead_id: leadId || null,
        conversation_id: conversationId || null,
        user_id: userId,
        note_text: noteText,
        is_pinned: isPinned || false,
      })
      .select(`
        *,
        user:users!chat_notes_user_id_fkey (
          name,
          email
        )
      `)
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'Nota criada com sucesso',
      data,
    });
  } catch (error: any) {
    console.error('Error creating chat note:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Erro ao criar nota' },
      { status: 500 }
    );
  }
}
