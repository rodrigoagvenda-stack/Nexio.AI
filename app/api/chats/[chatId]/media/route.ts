import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  req: NextRequest,
  { params }: { params: { chatId: string } }
) {
  try {
    const { chatId } = params;
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get('companyId');
    const type = searchParams.get('type'); // image, video, audio, document

    if (!companyId) {
      return NextResponse.json(
        { success: false, message: 'Company ID é obrigatório' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Buscar mensagens com mídia
    let query = supabase
      .from('mensagens_do_whatsapp')
      .select('*')
      .eq('id_da_conversacao', chatId)
      .eq('company_id', companyId)
      .not('url_da_midia', 'is', null)
      .order('carimbo_de_data_e_hora', { ascending: false });

    // Filtrar por tipo se especificado
    if (type) {
      query = query.eq('tipo_de_mensagem', type);
    }

    const { data: mediaMessages, error } = await query;

    if (error) {
      console.error('Error fetching media:', error);
      return NextResponse.json(
        { success: false, message: 'Erro ao buscar mídia' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: mediaMessages || [],
    });
  } catch (error) {
    console.error('Error in get media endpoint:', error);
    return NextResponse.json(
      { success: false, message: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
