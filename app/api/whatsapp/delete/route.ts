import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/require-auth';

export async function POST(request: NextRequest) {
  const { context, error: authError } = await requireAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { messageId, deleteForEveryone } = body;

    if (!messageId) {
      return NextResponse.json({ success: false, message: 'messageId é obrigatório' }, { status: 400 });
    }

    const supabase = await createClient();

    const [
      { data: message, error: messageError },
      { data: company, error: companyError }
    ] = await Promise.all([
      supabase
        .from('mensagens_do_whatsapp')
        .select('id, id_da_conversacao, whatsapp_message_id')
        .eq('id', messageId)
        .eq('company_id', context.companyId)
        .single(),
      supabase
        .from('companies')
        .select('whatsapp_instance, whatsapp_token')
        .eq('id', context.companyId)
        .single()
    ]);

    if (messageError || !message) {
      return NextResponse.json({ success: false, message: 'Mensagem não encontrada' }, { status: 404 });
    }

    if (companyError || !company?.whatsapp_instance || !company?.whatsapp_token) {
      return NextResponse.json({ success: false, message: 'Credenciais WhatsApp não configuradas' }, { status: 400 });
    }

    if (deleteForEveryone) {
      const { data: conversation } = await supabase
        .from('conversas_do_whatsapp')
        .select('numero_de_telefone')
        .eq('id', message.id_da_conversacao)
        .single();

      if (!conversation) {
        return NextResponse.json({ success: false, message: 'Conversa não encontrada' }, { status: 404 });
      }

      const response = await fetch(`${company.whatsapp_instance}/message/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': company.whatsapp_token },
        body: JSON.stringify({ number: conversation.numero_de_telefone, key: { id: message.whatsapp_message_id } }),
      });

      if (!response.ok) throw new Error('Erro ao apagar mensagem no WhatsApp');
    }

    const { error: deleteError } = await supabase
      .from('mensagens_do_whatsapp')
      .delete()
      .eq('id', messageId)
      .eq('company_id', context.companyId);

    if (deleteError) throw deleteError;

    return NextResponse.json({
      success: true,
      message: deleteForEveryone ? 'Mensagem apagada para todos' : 'Mensagem apagada para você',
    });
  } catch (error: any) {
    console.error('Error deleting message:', error);
    return NextResponse.json({ success: false, message: error.message || 'Erro ao apagar mensagem' }, { status: 500 });
  }
}
