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

export async function GET() {
  try {
    const companyId = await getCompanyId();
    if (!companyId) return NextResponse.json({ success: false, message: 'Não autorizado' }, { status: 401 });

    const service = createServiceClient();
    const { data } = await service
      .from('briefing_company_config')
      .select('*')
      .eq('company_id', companyId)
      .maybeSingle();

    return NextResponse.json({ success: true, data: data || null });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const companyId = await getCompanyId();
    if (!companyId) return NextResponse.json({ success: false, message: 'Não autorizado' }, { status: 401 });

    const body = await request.json();
    const { slug, is_active, primary_color, theme, logo_url, title, description, success_message, whatsapp_label, whatsapp_order_index } = body;

    const service = createServiceClient();

    const payload = {
      slug: slug || `empresa-${companyId}`,
      is_active: is_active ?? false,
      primary_color: primary_color || '#7c3aed',
      theme: theme || 'dark',
      logo_url: logo_url || null,
      title: title || null,
      description: description || null,
      success_message: success_message || null,
      whatsapp_label: whatsapp_label || null,
      whatsapp_order_index: whatsapp_order_index ?? null,
      updated_at: new Date().toISOString(),
    };

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
