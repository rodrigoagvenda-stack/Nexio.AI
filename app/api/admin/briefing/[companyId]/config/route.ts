import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

async function checkAdmin(supabase: any) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('admin_users').select('id').eq('auth_user_id', user.id).eq('is_active', true).single();
  return data ? user : null;
}

// GET: Buscar config de briefing da empresa
export async function GET(
  request: NextRequest,
  { params }: { params: { companyId: string } }
) {
  try {
    const supabase = await createClient();
    if (!await checkAdmin(supabase)) {
      return NextResponse.json({ success: false, message: 'Acesso negado' }, { status: 403 });
    }

    const service = createServiceClient();
    const { data, error } = await service
      .from('briefing_company_config')
      .select('*')
      .eq('company_id', params.companyId)
      .single();

    return NextResponse.json({ success: true, data: data || null });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// POST/PATCH: Criar ou atualizar config de briefing da empresa
export async function POST(
  request: NextRequest,
  { params }: { params: { companyId: string } }
) {
  try {
    const supabase = await createClient();
    if (!await checkAdmin(supabase)) {
      return NextResponse.json({ success: false, message: 'Acesso negado' }, { status: 403 });
    }

    const body = await request.json();
    const { slug, is_active, primary_color, theme, logo_url, title, description, webhook_url, success_message } = body;
    const companyId = parseInt(params.companyId);

    const service = createServiceClient();

    const payload = {
      slug: slug || `empresa-${companyId}`,
      is_active: is_active ?? false,
      primary_color: primary_color || '#7c3aed',
      theme: theme || 'dark',
      logo_url: logo_url || null,
      title: title || null,
      description: description || null,
      webhook_url: webhook_url || null,
      success_message: success_message || null,
      updated_at: new Date().toISOString(),
    };

    // Verificar se já existe registro para esta empresa
    const { data: existing } = await service
      .from('briefing_company_config')
      .select('id')
      .eq('company_id', companyId)
      .maybeSingle();

    let data, error;

    if (existing) {
      ({ data, error } = await service
        .from('briefing_company_config')
        .update(payload)
        .eq('company_id', companyId)
        .select()
        .single());
    } else {
      ({ data, error } = await service
        .from('briefing_company_config')
        .insert({ company_id: companyId, ...payload })
        .select()
        .single());
    }

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
