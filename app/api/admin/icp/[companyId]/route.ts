import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { companyId: string } }
) {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('icp_configuration')
      .select('*')
      .eq('company_id', params.companyId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    return NextResponse.json({ success: true, data: data || null });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { companyId: string } }
) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    // Verificar se já existe configuração
    const { data: existing } = await supabase
      .from('icp_configuration')
      .select('*')
      .eq('company_id', params.companyId)
      .single();

    let data, error;

    if (existing) {
      // Atualizar
      ({ data, error } = await supabase
        .from('icp_configuration')
        .update({ ...body, updated_at: new Date().toISOString() })
        .eq('company_id', params.companyId)
        .select()
        .single());
    } else {
      // Criar
      ({ data, error } = await supabase
        .from('icp_configuration')
        .insert([{ ...body, company_id: parseInt(params.companyId) }])
        .select()
        .single());
    }

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'ICP configurado com sucesso!',
      data,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
