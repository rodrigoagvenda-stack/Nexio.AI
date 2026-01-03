import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const {
      chatId,
      leadId,
      content,
      type = 'text',
      mediaUrl,
      scheduledFor,
      companyId,
      userId,
    } = await req.json();

    // Validações
    if (!content?.trim()) {
      return NextResponse.json(
        { success: false, message: 'Conteúdo da mensagem é obrigatório' },
        { status: 400 }
      );
    }

    if (!scheduledFor) {
      return NextResponse.json(
        { success: false, message: 'Data/hora de agendamento é obrigatória' },
        { status: 400 }
      );
    }

    if (!companyId || !userId) {
      return NextResponse.json(
        { success: false, message: 'Company ID e User ID são obrigatórios' },
        { status: 400 }
      );
    }

    // Validar se data é futura
    const scheduledDate = new Date(scheduledFor);
    if (scheduledDate <= new Date()) {
      return NextResponse.json(
        { success: false, message: 'A data deve ser futura' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Criar agendamento
    const { data: scheduledMessage, error } = await supabase
      .from('scheduled_messages')
      .insert({
        chat_id: chatId,
        lead_id: leadId,
        company_id: companyId,
        content: content.trim(),
        type,
        media_url: mediaUrl,
        scheduled_for: scheduledFor,
        status: 'pending',
        created_by: userId,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating scheduled message:', error);
      return NextResponse.json(
        { success: false, message: 'Erro ao agendar mensagem' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Mensagem agendada com sucesso',
      data: scheduledMessage,
    });
  } catch (error) {
    console.error('Error in schedule message endpoint:', error);
    return NextResponse.json(
      { success: false, message: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
