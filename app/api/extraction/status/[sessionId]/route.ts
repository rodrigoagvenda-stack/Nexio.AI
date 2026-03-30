import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

// Consultado pelo frontend via polling
export async function GET(
  _request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from('extraction_sessions')
      .select('id, requested, inserted, status, created_at, completed_at')
      .eq('id', params.sessionId)
      .single();

    if (error || !data) {
      return NextResponse.json({ success: false, message: 'Sessão não encontrada' }, { status: 404 });
    }

    return NextResponse.json({ success: true, session: data });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
