import { NextRequest, NextResponse } from 'next/server';
import { extractLeadsFromMaps } from '@/lib/n8n/client';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { startUrl, quantity, companyId } = body;

    if (!startUrl || !quantity || !companyId) {
      return NextResponse.json(
        { success: false, message: 'Dados incompletos' },
        { status: 400 }
      );
    }

    // Chamar n8n para extrair leads
    const result = await extractLeadsFromMaps(startUrl, quantity, companyId);

    return NextResponse.json({
      success: true,
      extractedCount: quantity, // n8n retornará o count real
      message: 'Leads extraídos com sucesso!',
    });
  } catch (error: any) {
    console.error('Error in maps extraction:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Erro ao extrair leads' },
      { status: 500 }
    );
  }
}
