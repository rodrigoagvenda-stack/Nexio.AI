import { NextRequest, NextResponse } from 'next/server';
import { extractICPLeads } from '@/lib/n8n/client';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId } = body;

    if (!companyId) {
      return NextResponse.json(
        { success: false, message: 'Company ID obrigatório' },
        { status: 400 }
      );
    }

    // Buscar configuração do ICP
    const supabase = await createClient();
    const { data: icpConfig, error: icpError } = await supabase
      .from('icp_configuration')
      .select('*')
      .eq('company_id', companyId)
      .single();

    if (icpError || !icpConfig) {
      return NextResponse.json(
        { success: false, message: 'ICP não configurado para esta empresa' },
        { status: 404 }
      );
    }

    // Chamar n8n para extrair leads ICP com TODAS as configurações
    const result = await extractICPLeads(companyId, icpConfig);

    return NextResponse.json({
      success: true,
      extractedCount: result.data?.extractedCount || 0,
      remaining: result.data?.remaining || 0,
      message: 'Leads ICP extraídos com sucesso!',
    });
  } catch (error: any) {
    console.error('Error in ICP extraction:', error);

    // Retornar erro detalhado para debug
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Erro ao extrair leads ICP',
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
          cause: error.cause,
        }
      },
      { status: 500 }
    );
  }
}
