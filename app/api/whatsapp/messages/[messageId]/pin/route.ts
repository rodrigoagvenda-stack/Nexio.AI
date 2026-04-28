import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/require-auth';

export async function PATCH(req: NextRequest, { params }: { params: { messageId: string } }) {
  const { context, error: authError } = await requireAuth(req);
  if (authError) return authError;

  try {
    const { messageId } = params;
    const { isPinned } = await req.json();

    if (typeof isPinned !== 'boolean') {
      return NextResponse.json({ success: false, message: 'isPinned deve ser um boolean' }, { status: 400 });
    }

    const supabase = await createClient();

    if (isPinned) {
      const { data: message } = await supabase.from('mensagens_do_whatsapp').select('id_da_conversacao').eq('id', messageId).eq('company_id', context.companyId).single();
      if (message?.id_da_conversacao) {
        await supabase.from('mensagens_do_whatsapp').update({ is_pinned: false }).eq('id_da_conversacao', message.id_da_conversacao).eq('company_id', context.companyId).eq('is_pinned', true);
      }
    }

    const { data: updatedMessage, error: updateError } = await supabase
      .from('mensagens_do_whatsapp')
      .update({ is_pinned: isPinned })
      .eq('id', messageId)
      .eq('company_id', context.companyId)
      .select()
      .single();

    if (updateError) throw updateError;

    const { data: company } = await supabase.from('companies').select('whatsapp_instance, whatsapp_token').eq('id', context.companyId).single();

    if (company?.whatsapp_instance && company?.whatsapp_token && updatedMessage.id_externo) {
      try {
        await fetch(`${company.whatsapp_instance}${isPinned ? '/message/pin' : '/message/unpin'}`, {
          method: 'POST',
          headers: { 'apikey': company.whatsapp_token, 'Content-Type': 'application/json' },
          body: JSON.stringify({ messageId: updatedMessage.id_externo }),
        });
      } catch (e) { console.error('Error calling UAZapi to pin message:', e); }
    }

    return NextResponse.json({ success: true, message: isPinned ? 'Mensagem fixada com sucesso' : 'Mensagem desafixada com sucesso', data: updatedMessage });
  } catch (error) {
    console.error('Error in pin message endpoint:', error);
    return NextResponse.json({ success: false, message: 'Erro interno do servidor' }, { status: 500 });
  }
}
