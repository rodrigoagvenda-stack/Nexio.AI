import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { extractLeadsFromMaps } from '@/lib/n8n/client';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Verificar autenticação
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Não autorizado' },
        { status: 401 }
      );
    }

    const { url, limit, companyId } = await request.json();

    // Validações
    if (!url || !limit || !companyId) {
      return NextResponse.json(
        { success: false, message: 'Dados incompletos' },
        { status: 400 }
      );
    }

    // Validar URL do Google Maps (.com e .com.br)
    const googleMapsPattern = /^https?:\/\/(www\.)?google\.com(\.br)?\/maps\//i;
    if (!googleMapsPattern.test(url)) {
      return NextResponse.json(
        {
          success: false,
          message: 'URL inválida. Use uma URL do Google Maps (.com ou .com.br)',
        },
        { status: 400 }
      );
    }

    // Verificar se empresa tem VendAgro ativo
    const { data: company } = await supabase
      .from('companies')
      .select('vendagro_plan, leads_extracted_this_month, plan_monthly_limit')
      .eq('id', companyId)
      .single();

    if (!company) {
      return NextResponse.json(
        { success: false, message: 'Empresa não encontrada' },
        { status: 404 }
      );
    }

    if (!company.vendagro_plan) {
      return NextResponse.json(
        {
          success: false,
          message: 'Plano VendAgro não ativo. Entre em contato com o admin.',
        },
        { status: 403 }
      );
    }

    // Verificar limite mensal
    const extracted = company.leads_extracted_this_month || 0;
    const monthlyLimit = company.plan_monthly_limit || 0;
    const remaining = monthlyLimit - extracted;

    if (remaining <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: 'Limite mensal de leads atingido',
        },
        { status: 403 }
      );
    }

    const leadsToExtract = Math.min(limit, remaining);

    // Chamar n8n para extrair leads do Google Maps
    const extractionResult = await extractLeadsFromMaps(url, leadsToExtract, companyId);

    if (!extractionResult.success) {
      return NextResponse.json(
        {
          success: false,
          message: extractionResult.message || 'Erro ao extrair leads via n8n',
        },
        { status: 500 }
      );
    }

    const actualExtracted = extractionResult.data?.extractedCount || leadsToExtract;

    // Atualizar contador de leads extraídos
    const { error: updateError } = await supabase
      .from('companies')
      .update({
        leads_extracted_this_month: extracted + actualExtracted,
      })
      .eq('id', companyId);

    if (updateError) {
      console.error('Error updating company stats:', updateError);
    }

    // Registrar log de atividade
    await supabase.from('activity_logs').insert({
      user_id: user.id,
      company_id: companyId,
      action: 'lead_extraction',
      description: `Extraiu ${actualExtracted} leads do Google Maps`,
      metadata: {
        url,
        limit,
        extracted: actualExtracted,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Leads extraídos com sucesso',
      extractedCount: actualExtracted,
      remaining: remaining - actualExtracted,
    });
  } catch (error: any) {
    console.error('Maps extraction error:', error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Erro interno do servidor',
      },
      { status: 500 }
    );
  }
}
