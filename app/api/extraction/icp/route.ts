import { NextRequest, NextResponse } from 'next/server';
import { extractICPLeads } from '@/lib/n8n/client';

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

    // Chamar n8n para extrair leads ICP
    const result = await extractICPLeads(companyId);

    return NextResponse.json({
      success: true,
      extractedCount: result.data?.extractedCount || 0,
      remaining: result.data?.remaining || 0,
      message: 'Leads ICP extraídos com sucesso!',
    });
  } catch (error: any) {
    console.error('Error in ICP extraction:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Erro ao extrair leads ICP' },
      { status: 500 }
    );
  }
}
