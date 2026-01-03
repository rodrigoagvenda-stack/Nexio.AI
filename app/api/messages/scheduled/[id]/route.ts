import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Editar agendamento
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const { content, scheduledFor, companyId } = await req.json();

    if (!companyId) {
      return NextResponse.json(
        { success: false, message: 'Company ID é obrigatório' },
        { status: 400 }
      );
    }

    // Validar se data é futura
    if (scheduledFor) {
      const scheduledDate = new Date(scheduledFor);
      if (scheduledDate <= new Date()) {
        return NextResponse.json(
          { success: false, message: 'A data deve ser futura' },
          { status: 400 }
        );
      }
    }

    const supabase = await createClient();

    // Verificar se o agendamento existe e pertence à empresa
    const { data: existing, error: checkError } = await supabase
      .from('scheduled_messages')
      .select('*')
      .eq('id', id)
      .eq('company_id', companyId)
      .eq('status', 'pending')
      .single();

    if (checkError || !existing) {
      return NextResponse.json(
        { success: false, message: 'Agendamento não encontrado ou já foi enviado' },
        { status: 404 }
      );
    }

    // Atualizar agendamento
    const updateData: any = {};
    if (content) updateData.content = content.trim();
    if (scheduledFor) updateData.scheduled_for = scheduledFor;

    const { data: updated, error: updateError } = await supabase
      .from('scheduled_messages')
      .update(updateData)
      .eq('id', id)
      .eq('company_id', companyId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating scheduled message:', updateError);
      return NextResponse.json(
        { success: false, message: 'Erro ao atualizar agendamento' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Agendamento atualizado com sucesso',
      data: updated,
    });
  } catch (error) {
    console.error('Error in update scheduled message endpoint:', error);
    return NextResponse.json(
      { success: false, message: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// Cancelar agendamento
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get('companyId');

    if (!companyId) {
      return NextResponse.json(
        { success: false, message: 'Company ID é obrigatório' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Marcar como cancelado ao invés de deletar (manter histórico)
    const { data: cancelled, error } = await supabase
      .from('scheduled_messages')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('company_id', companyId)
      .eq('status', 'pending')
      .select()
      .single();

    if (error) {
      console.error('Error cancelling scheduled message:', error);
      return NextResponse.json(
        { success: false, message: 'Erro ao cancelar agendamento' },
        { status: 500 }
      );
    }

    if (!cancelled) {
      return NextResponse.json(
        { success: false, message: 'Agendamento não encontrado ou já foi enviado' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Agendamento cancelado com sucesso',
      data: cancelled,
    });
  } catch (error) {
    console.error('Error in cancel scheduled message endpoint:', error);
    return NextResponse.json(
      { success: false, message: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
