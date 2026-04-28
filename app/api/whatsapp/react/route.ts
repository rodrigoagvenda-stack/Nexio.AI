import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/require-auth';

export async function POST(request: NextRequest) {
  const { context, error: authError } = await requireAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { messageId, emoji } = body;

    if (!messageId || !emoji) {
      return NextResponse.json({ success: false, message: 'Dados obrigatórios faltando' }, { status: 400 });
    }

    const supabase = await createClient();

    const [
      { data: message, error: messageError },
      { data: company, error: companyError }
    ] = await Promise.all([
      supabase.from('mensagens_do_whatsapp').select('id, id_da_conversacao, whatsapp_message_id').eq('id', messageId).eq('company_id', context.companyId).single(),
      supabase.from('companies').select('whatsapp_instance, whatsapp_token').eq('id', context.companyId).single()
    ]);

    if (messageError || !message) return NextResponse.json({ success: false, message: 'Mensagem não encontrada' }, { status: 404 });
    if (companyError || !company?.whatsapp_instance) return NextResponse.json({ success: false, message: 'Credenciais WhatsApp não configuradas' }, { status: 400 });

    const { data: conversation } = await supabase.from('conversas_do_whatsapp').select('numero_de_telefone').eq('id', message.id_da_conversacao).single();
    if (!conversation) return NextResponse.json({ success: false, message: 'Conversa não encontrada' }, { status: 404 });

    const response = await fetch(`${company.whatsapp_instance}/message/sendReaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': company.whatsapp_token },
      body: JSON.stringify({ number: conversation.numero_de_telefone, key: { id: message.whatsapp_message_id }, reaction: emoji }),
    });

    if (!response.ok) throw new Error('Erro ao enviar reação via WhatsApp');

    return NextResponse.json({ success: true, message: 'Reação enviada com sucesso' });
  } catch (error: any) {
    console.error('Error sending reaction:', error);
    return NextResponse.json({ success: false, message: error.message || 'Erro ao enviar reação' }, { status: 500 });
  }
}
