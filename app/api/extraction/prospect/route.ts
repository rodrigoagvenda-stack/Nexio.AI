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

    const { url, limit, companyId, cidade, estado, nicho } = await request.json();

    // Validações básicas
    if (!limit || !companyId) {
      return NextResponse.json(
        { success: false, message: 'Dados incompletos: limite e empresa são obrigatórios' },
        { status: 400 }
      );
    }

    // Validar se tem URL OU (cidade + estado + nicho)
    if (!url && (!cidade || !estado || !nicho)) {
      return NextResponse.json(
        {
          success: false,
          message: 'Forneça uma URL do Google Maps ou preencha cidade, estado e nicho',
        },
        { status: 400 }
      );
    }

    let finalUrl = url;

    // Se não tem URL, construir a partir dos dados manuais
    if (!finalUrl && cidade && estado && nicho) {
      const query = `${nicho} em ${cidade}, ${estado}`;
      const encodedQuery = encodeURIComponent(query);
      finalUrl = `https://www.google.com.br/maps/search/${encodedQuery}`;
    }

    // Validar URL do Google Maps (.com e .com.br)
    const googleMapsPattern = /^https?:\/\/(www\.)?google\.com(\.br)?\/maps\//i;
    if (!googleMapsPattern.test(finalUrl)) {
      return NextResponse.json(
        {
          success: false,
          message: 'URL inválida. Use uma URL do Google Maps (.com ou .com.br)',
        },
        { status: 400 }
      );
    }

    // Verificar se empresa existe
    const { data: company } = await supabase
      .from('companies')
      .select('id, name')
      .eq('id', companyId)
      .single();

    if (!company) {
      return NextResponse.json(
        { success: false, message: 'Empresa não encontrada' },
        { status: 404 }
      );
    }

    // prospect.AI está disponível para todos, sem necessidade de plano VendAgro
    // Limitar a um número razoável de leads por extração
    const maxLeadsPerExtraction = 500;
    const leadsToExtract = Math.min(limit, maxLeadsPerExtraction);

    // Chamar n8n para extrair leads do Google Maps
    const extractionResult = await extractLeadsFromMaps(finalUrl, leadsToExtract, companyId);

    if (!extractionResult.success) {
      return NextResponse.json(
        {
          success: false,
          message: extractionResult.message || 'Erro ao extrair leads via n8n',
        },
        { status: 500 }
      );
    }

    // Registrar log de atividade
    await supabase.from('activity_logs').insert({
      user_id: user.id,
      company_id: companyId,
      action: 'prospect_extraction',
      description: `Extraiu ${leadsToExtract} leads via prospect.AI`,
      metadata: {
        url: finalUrl,
        limit,
        extracted: leadsToExtract,
        cidade,
        estado,
        nicho,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Leads extraídos com sucesso via prospect.AI',
      extractedCount: extractionResult.data?.extractedCount || leadsToExtract,
      query: cidade && estado && nicho ? `${nicho} em ${cidade}, ${estado}` : undefined,
    });
  } catch (error: any) {
    console.error('Prospect extraction error:', error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Erro interno do servidor',
      },
      { status: 500 }
    );
  }
}
