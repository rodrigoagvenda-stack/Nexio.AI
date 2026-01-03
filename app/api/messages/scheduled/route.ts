import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get('companyId');
    const chatId = searchParams.get('chatId');
    const leadId = searchParams.get('leadId');
    const status = searchParams.get('status') || 'pending';

    if (!companyId) {
      return NextResponse.json(
        { success: false, message: 'Company ID é obrigatório' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    let query = supabase
      .from('scheduled_messages')
      .select(`
        *,
        chat:conversas_do_whatsapp!scheduled_messages_chat_id_fkey(
          id,
          numero_de_telefone,
          nome_do_contato
        ),
        lead:leads!scheduled_messages_lead_id_fkey(
          id,
          company_name,
          contact_name
        ),
        creator:users!scheduled_messages_created_by_fkey(
          name
        )
      `)
      .eq('company_id', companyId)
      .eq('status', status)
      .order('scheduled_for', { ascending: true });

    // Filtros opcionais
    if (chatId) {
      query = query.eq('chat_id', chatId);
    }

    if (leadId) {
      query = query.eq('lead_id', leadId);
    }

    const { data: scheduledMessages, error } = await query;

    if (error) {
      console.error('Error fetching scheduled messages:', error);
      return NextResponse.json(
        { success: false, message: 'Erro ao buscar mensagens agendadas' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: scheduledMessages || [],
    });
  } catch (error) {
    console.error('Error in get scheduled messages endpoint:', error);
    return NextResponse.json(
      { success: false, message: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
