import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

async function getCompanyId() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from('users')
    .select('company_id')
    .eq('auth_user_id', user.id)
    .single();
  return data?.company_id ?? null;
}

export async function GET(request: NextRequest) {
  try {
    const companyId = await getCompanyId();
    if (!companyId) return NextResponse.json({ success: false, message: 'Não autorizado' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    const service = createServiceClient();
    const { data, error, count } = await service
      .from('briefing_mt_responses')
      .select('*', { count: 'exact' })
      .eq('company_id', companyId)
      .order('submitted_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return NextResponse.json({ success: true, data: data || [], pagination: { page, limit, total: count || 0 } });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
