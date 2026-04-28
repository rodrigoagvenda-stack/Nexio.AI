import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/require-auth';

export async function PATCH(req: NextRequest, { params }: { params: { messageId: string } }) {
  const { context, error: authError } = await requireAuth(req);
  if (authError) return authError;

  try {
    const { messageId } = params;
    const { newMessage } = await req.json();

    if (!newMessage?.trim()) {
      return NextResponse.json({ success: false, message: 'Mensagem não pode estar vazia' }, { status: 400 });
    }

    const supabase = await createClient();

    const [{ data: company }, { data: message, error: messageError }] = await Promise.all([
      supabase.from('companies').select('whatsapp_instance, whatsapp_token').eq('id', context.companyId).single(),
      supabase.from('mensagens_do_whatsapp').select('*').eq('id', messageId).eq('company_id', context.companyId).single(),
    ]);

    if (messageError || !message) return NextResponse.json({ success: false, message: 'Mensagem não encontrada' }, { status: 404 });
    if (message.direcao !== 'outbound') return NextResponse.json({ success: false, message: 'Só é possível editar mensagens enviadas por você' }, { status: 403 });

    if (message.id_externo && company?.whatsapp_instance && company?.whatsapp_token) {
      try {
        await fetch(`${company.whatsapp_instance}/message/edit`, {
          method: 'PUT',
          headers: { 'apikey': company.whatsapp_token, 'Content-Type': 'application/json' },
          body: JSON.stringify({ messageId: message.id_externo, newText: newMessage.trim() }),
        });
      } catch (e) { console.error('Error calling UAZapi to edit message:', e); }
    }

    const { data: updatedMessage, error: updateError } = await supabase
      .from('mensagens_do_whatsapp')
      .update({ texto_da_mensagem: newMessage.trim(), is_edited: true, edited_at: new Date().toISOString() })
      .eq('id', messageId)
      .eq('company_id', context.companyId)
      .select()
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({ success: true, message: 'Mensagem editada com sucesso', data: updatedMessage });
  } catch (error) {
    console.error('Error in edit message endpoint:', error);
    return NextResponse.json({ success: false, message: 'Erro interno do servidor' }, { status: 500 });
  }
}
