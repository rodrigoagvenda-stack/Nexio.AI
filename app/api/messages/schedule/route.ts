import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/require-auth';

export async function POST(request: NextRequest) {
  const { context, error: authError } = await requireAuth(request);
  if (authError) return authError;

  try {
    const { chatId, leadId, content, type = 'text', mediaUrl, scheduledFor } = await request.json();

    if (!content?.trim()) {
      return NextResponse.json({ success: false, message: 'Conteúdo da mensagem é obrigatório' }, { status: 400 });
    }

    if (!scheduledFor) {
      return NextResponse.json({ success: false, message: 'Data/hora de agendamento é obrigatória' }, { status: 400 });
    }

    const scheduledDate = new Date(scheduledFor);
    if (scheduledDate <= new Date()) {
      return NextResponse.json({ success: false, message: 'A data deve ser futura' }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: scheduledMessage, error } = await supabase
      .from('scheduled_messages')
      .insert({
        chat_id: chatId,
        lead_id: leadId,
        company_id: context.companyId,
        content: content.trim(),
        type,
        media_url: mediaUrl,
        scheduled_for: scheduledFor,
        status: 'pending',
        created_by: context.userId,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Mensagem agendada com sucesso', data: scheduledMessage });
  } catch (error) {
    console.error('Error in schedule message endpoint:', error);
    return NextResponse.json({ success: false, message: 'Erro interno do servidor' }, { status: 500 });
  }
}
