import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth';

export async function GET(req: NextRequest) {
  const { context, error: authError } = await requireAuth(req);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(req.url);
    const chatId = searchParams.get('chatId');
    const leadId = searchParams.get('leadId');
    const status = searchParams.get('status') || 'pending';

    const { createClient } = await import('@/lib/supabase/server');
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
      .eq('company_id', context.companyId)
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
