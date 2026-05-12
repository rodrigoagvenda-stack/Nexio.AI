import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireAuth, validateCompanyAccess } from '@/lib/auth/require-auth';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { leadId: string } }
) {
  const { context, error: authError } = await requireAuth(request);
  if (authError) return authError;

  try {
    const { leadId } = params;
    const body = await request.json();
    const { companyId, field, value } = body;

    if (!leadId || !companyId || !field) {
      return NextResponse.json({ success: false, message: 'Dados obrigatórios faltando' }, { status: 400 });
    }

    const accessError = validateCompanyAccess(parseInt(companyId), context.companyId);
    if (accessError) return accessError;

    const supabase = createServiceClient();

    const allowedFields = [
      'segment', 'priority', 'status', 'nivel_interesse', 'import_source',
      'cargo', 'project_value', 'company_name', 'contact_name', 'whatsapp',
      'email', 'website_or_instagram', 'notes', 'mql_resumo',
    ];

    if (!allowedFields.includes(field)) {
      return NextResponse.json({ success: false, message: `Campo '${field}' não é editável` }, { status: 400 });
    }

    const updateData: any = { [field]: value, updated_at: new Date().toISOString() };

    if (field === 'status' && value === 'Fechado') updateData.closed_at = new Date().toISOString();
    if (field === 'status' && value !== 'Fechado') updateData.closed_at = null;

    if (field === 'status' && value === 'Outbound') {
      const serviceClient = createServiceClient();
      await serviceClient.from('outbound_campaigns').delete().eq('campaign_id', parseInt(leadId));
    }

    const { data, error } = await supabase
      .from('leads')
      .update(updateData)
      .eq('id', leadId)
      .eq('company_id', context.companyId)
      .select()
      .single();

    if (error) throw error;
    if (!data) return NextResponse.json({ success: false, message: 'Lead não encontrado' }, { status: 404 });

    return NextResponse.json({ success: true, message: `Campo '${field}' atualizado com sucesso`, data });
  } catch (error: any) {
    console.error('Error updating lead field:', error);
    return NextResponse.json({ success: false, message: error.message || 'Erro ao atualizar lead' }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { leadId: string } }
) {
  const { context, error: authError } = await requireAuth(request);
  if (authError) return authError;

  try {
    const { leadId } = params;
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .eq('company_id', context.companyId)
      .single();

    if (error) throw error;
    if (!data) return NextResponse.json({ success: false, message: 'Lead não encontrado' }, { status: 404 });

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Error fetching lead:', error);
    return NextResponse.json({ success: false, message: error.message || 'Erro ao buscar lead' }, { status: 500 });
  }
}
