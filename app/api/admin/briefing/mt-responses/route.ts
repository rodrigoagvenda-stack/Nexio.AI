import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

async function checkAdmin(supabase: any) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from('admin_users')
    .select('id')
    .eq('auth_user_id', user.id)
    .eq('is_active', true)
    .single();
  return data ? user : null;
}

// GET: Listar todas as respostas de briefing multi-tenant (com nome da empresa)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    if (!await checkAdmin(supabase)) {
      return NextResponse.json({ success: false, message: 'Acesso negado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('company_id');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    const service = createServiceClient();

    let query = service
      .from('briefing_responses')
      .select('id, company_id, answers, submitted_at, webhook_sent, webhook_sent_at', { count: 'exact' })
      .order('submitted_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (companyId) {
      query = query.eq('company_id', companyId);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    // Buscar nomes das empresas separadamente para evitar problema de schema cache
    const companyIds = [...new Set((data || []).map((r: any) => r.company_id))];
    let companiesMap: Record<number, string> = {};

    if (companyIds.length > 0) {
      const { data: companies } = await service
        .from('companies')
        .select('id, name')
        .in('id', companyIds);

      if (companies) {
        companiesMap = Object.fromEntries(companies.map((c: any) => [c.id, c.name]));
      }
    }

    const enriched = (data || []).map((r: any) => ({
      ...r,
      companies: { id: r.company_id, name: companiesMap[r.company_id] || `Empresa #${r.company_id}` },
    }));

    return NextResponse.json({
      success: true,
      data: enriched,
      pagination: { page, limit, total: count || 0 },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
