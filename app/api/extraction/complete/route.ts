import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

// Chamado pelo n8n quando o fluxo inteiro finaliza
export async function POST(request: NextRequest) {
  try {
    const { session_id } = await request.json();

    if (!session_id) {
      return NextResponse.json({ success: false, message: 'session_id obrigatório' }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from('extraction_sessions')
      .update({ status: 'complete', completed_at: new Date().toISOString() })
      .eq('id', session_id)
      .select('inserted, requested')
      .single();

    if (error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, inserted: data.inserted, requested: data.requested });
  } catch (error: any) {
    console.error('[Complete] Erro:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
