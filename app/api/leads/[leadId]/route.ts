import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { leadId: string } }
) {
  try {
    const { leadId } = params;
    const body = await request.json();
    const { companyId, field, value } = body;

    if (!leadId || !companyId || !field) {
      return NextResponse.json(
        { success: false, message: 'Dados obrigatórios faltando' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Campos editáveis permitidos
    const allowedFields = [
      'segment',
      'priority',
      'status',
      'nivel_interesse',
      'import_source',
      'cargo',
      'project_value',
      'company_name',
      'contact_name',
      'whatsapp',
      'email',
      'website_or_instagram',
      'notes',
      'mql_resumo',
    ];

    if (!allowedFields.includes(field)) {
      return NextResponse.json(
        { success: false, message: `Campo '${field}' não é editável` },
        { status: 400 }
      );
    }

    // Preparar objeto de atualização
    const updateData: any = {
      [field]: value,
      updated_at: new Date().toISOString(),
    };

    // Se o status está sendo alterado para "Fechado", registrar a data
    if (field === 'status' && value === 'Fechado') {
      updateData.closed_at = new Date().toISOString();
    }

    // Se o status está sendo alterado de "Fechado" para outro, limpar closed_at
    if (field === 'status' && value !== 'Fechado') {
      updateData.closed_at = null;
    }

    // Executar update com filtro de company_id (segurança)
    const { data, error } = await supabase
      .from('leads')
      .update(updateData)
      .eq('id', leadId)
      .eq('company_id', companyId) // 🔒 Segurança: isolamento por empresa
      .select()
      .single();

    if (error) throw error;

    if (!data) {
      return NextResponse.json(
        { success: false, message: 'Lead não encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Campo '${field}' atualizado com sucesso`,
      data,
    });
  } catch (error: any) {
    console.error('Error updating lead field:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Erro ao atualizar lead' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { leadId: string } }
) {
  try {
    const { leadId } = params;
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    if (!companyId) {
      return NextResponse.json(
        { success: false, message: 'companyId é obrigatório' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .eq('company_id', companyId) // 🔒 Segurança
      .single();

    if (error) throw error;

    if (!data) {
      return NextResponse.json(
        { success: false, message: 'Lead não encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error: any) {
    console.error('Error fetching lead:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Erro ao buscar lead' },
      { status: 500 }
    );
  }
}
