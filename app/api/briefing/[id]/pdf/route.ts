import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { renderToStream } from '@react-pdf/renderer';
import { BriefingPDF } from '@/lib/pdf/briefing-generator';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServiceClient();
    const { id } = params;

    // Buscar resposta do briefing
    const { data: briefing, error } = await supabase
      .from('briefing_responses')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!briefing) {
      return NextResponse.json(
        { success: false, message: 'Briefing não encontrado' },
        { status: 404 }
      );
    }

    // Gerar PDF
    const stream = await renderToStream(<BriefingPDF data={briefing} />);

    // Retornar como download
    return new NextResponse(stream as any, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="briefing-${briefing.nome_empresa.replace(/\s+/g, '-')}-${id}.pdf"`,
      },
    });
  } catch (error: any) {
    console.error('Error generating PDF:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
