import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET: Listar auto-respostas
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const activeOnly = searchParams.get('activeOnly') === 'true';

    if (!companyId) {
      return NextResponse.json(
        { success: false, error: 'companyId é obrigatório' },
        { status: 400 }
      );
    }

    let query = supabase
      .from('auto_responses')
      .select('*')
      .eq('company_id', companyId);

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query.order('priority', { ascending: false });

    if (error) {
      console.error('Error fetching auto-responses:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, responses: data || [] });
  } catch (error) {
    console.error('Error in GET /api/automation/auto-responses:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// POST: Criar nova auto-resposta
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { companyId, name, keywords, response_message, match_type, case_sensitive, priority } = body;

    if (!companyId || !name || !keywords || !response_message) {
      return NextResponse.json(
        { success: false, error: 'Campos obrigatórios: companyId, name, keywords, response_message' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('auto_responses')
      .insert({
        company_id: companyId,
        name,
        keywords: Array.isArray(keywords) ? keywords : [keywords],
        response_message,
        match_type: match_type || 'contains',
        case_sensitive: case_sensitive || false,
        priority: priority || 0,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating auto-response:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, response: data });
  } catch (error) {
    console.error('Error in POST /api/automation/auto-responses:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
