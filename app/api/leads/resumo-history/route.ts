import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth';
import { createClient } from '@/lib/supabase/server';

// GET /api/leads/resumo-history?leadId=123 : histórico versionado do
// Resumo da IA (snapshot a cada atualização real, não só o mais recente).
export async function GET(request: NextRequest) {
  const { context, error: authError } = await requireAuth(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const leadId = searchParams.get('leadId');

    if (!leadId || isNaN(Number(leadId))) {
      return NextResponse.json({ success: false, message: 'leadId obrigatório' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('lead_resumo_history')
      .select('id, resumo_ia, segment, priority, nivel_interesse, created_at')
      .eq('company_id', context.companyId)
      .eq('lead_id', Number(leadId))
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, data: data ?? [] });
  } catch (error: any) {
    console.error('Error fetching lead resumo history:', error);
    return NextResponse.json({ success: false, message: error.message || 'Erro ao buscar histórico' }, { status: 500 });
  }
}
