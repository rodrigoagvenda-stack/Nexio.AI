import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

// Chamado pelo n8n para cada lead com WhatsApp válido
export async function POST(request: NextRequest) {
  try {
    const { session_id } = await request.json();

    if (!session_id) {
      return NextResponse.json({ success: false, message: 'session_id obrigatório' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Lê o valor atual e incrementa (+1 por lead válido)
    const { data: session, error: fetchError } = await supabase
      .from('extraction_sessions')
      .select('inserted')
      .eq('id', session_id)
      .single();

    if (fetchError || !session) {
      return NextResponse.json({ success: false, message: 'Sessão não encontrada' }, { status: 404 });
    }

    const newCount = (session.inserted ?? 0) + 1;

    await supabase
      .from('extraction_sessions')
      .update({ inserted: newCount })
      .eq('id', session_id);

    return NextResponse.json({ success: true, inserted: newCount });
  } catch (error: any) {
    console.error('[Callback] Erro:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
