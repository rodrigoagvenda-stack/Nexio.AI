import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, message: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { user_id, company_id, action, description, metadata } = body;

    if (!company_id || !action) {
      return NextResponse.json(
        { success: false, message: 'company_id e action são obrigatórios' },
        { status: 400 }
      );
    }

    // Usar service client para bypassar RLS
    const serviceSupabase = createServiceClient();

    const { error } = await serviceSupabase.from('activity_logs').insert({
      user_id,
      company_id,
      action,
      description,
      metadata,
    });

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    // Log silencioso — não bloquear o fluxo principal
    console.error('activity-logs error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
