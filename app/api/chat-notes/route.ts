import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/require-auth';

export async function GET(request: NextRequest) {
  const { context, error: authError } = await requireAuth(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const leadId = searchParams.get('leadId');
    const conversationId = searchParams.get('conversationId');

    if (leadId && (isNaN(Number(leadId)) || leadId.includes(':'))) {
      return NextResponse.json({ success: false, message: 'Formato inválido de leadId' }, { status: 400 });
    }

    const supabase = await createClient();

    let query = supabase
      .from('chat_notes')
      .select('*, user:users!chat_notes_user_id_fkey(name, email)')
      .eq('company_id', context.companyId)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false });

    if (leadId) query = query.eq('lead_id', Number(leadId));
    else if (conversationId) query = query.eq('conversation_id', conversationId);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, data: data || [] });
  } catch (error: any) {
    console.error('Error fetching chat notes:', error);
    return NextResponse.json({ success: false, message: error.message || 'Erro ao buscar notas' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { context, error: authError } = await requireAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { leadId, conversationId, noteText, isPinned } = body;

    if (!noteText) {
      return NextResponse.json({ success: false, message: 'noteText é obrigatório' }, { status: 400 });
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('chat_notes')
      .insert({
        company_id: context.companyId,
        lead_id: leadId || null,
        conversation_id: conversationId || null,
        user_id: context.userId,
        note_text: noteText,
        is_pinned: isPinned || false,
      })
      .select('*, user:users!chat_notes_user_id_fkey(name, email)')
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Nota criada com sucesso', data });
  } catch (error: any) {
    console.error('Error creating chat note:', error);
    return NextResponse.json({ success: false, message: error.message || 'Erro ao criar nota' }, { status: 500 });
  }
}
