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

    // Incremento atômico via RPC — evita race condition quando múltiplos
    // callbacks chegam em paralelo (todos liam o mesmo valor e sobrescreviam)
    const { data, error } = await supabase.rpc('increment_extraction_session', {
      p_session_id: session_id,
    });

    if (error) {
      console.error('[Callback] Erro no RPC:', error);
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, inserted: data });
  } catch (error: any) {
    console.error('[Callback] Erro:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
