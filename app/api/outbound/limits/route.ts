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
    const { company_id, limite_diario } = body;

    if (!company_id) {
      return NextResponse.json({ success: false, message: 'company_id obrigatório' }, { status: 400 });
    }

    const serviceSupabase = createServiceClient();

    // UPDATE por company_id (cobre múltiplas rows se houver duplicatas)
    const { error: updateError } = await serviceSupabase
      .from('outbound_limits')
      .update({ limite_diario })
      .eq('company_id', Number(company_id));

    if (updateError) throw updateError;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('outbound limits error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
