import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// PUT: Atualizar auto-resposta
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { companyId, ...updates } = body;
    const responseId = parseInt(params.id);

    if (!companyId || !responseId) {
      return NextResponse.json(
        { success: false, error: 'companyId e id são obrigatórios' },
        { status: 400 }
      );
    }

    // Converter keywords para array se necessário
    if (updates.keywords && !Array.isArray(updates.keywords)) {
      updates.keywords = [updates.keywords];
    }

    const { data, error } = await supabase
      .from('auto_responses')
      .update(updates)
      .eq('id', responseId)
      .eq('company_id', companyId)
      .select()
      .single();

    if (error) {
      console.error('Error updating auto-response:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, response: data });
  } catch (error) {
    console.error('Error in PUT /api/automation/auto-responses/[id]:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// DELETE: Deletar auto-resposta
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const responseId = parseInt(params.id);

    if (!companyId || !responseId) {
      return NextResponse.json(
        { success: false, error: 'companyId e id são obrigatórios' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('auto_responses')
      .delete()
      .eq('id', responseId)
      .eq('company_id', companyId);

    if (error) {
      console.error('Error deleting auto-response:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/automation/auto-responses/[id]:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// PATCH: Incrementar contador de uso
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { companyId } = body;
    const responseId = parseInt(params.id);

    if (!companyId || !responseId) {
      return NextResponse.json(
        { success: false, error: 'companyId e id são obrigatórios' },
        { status: 400 }
      );
    }

    // Buscar contador atual
    const { data: currentResponse } = await supabase
      .from('auto_responses')
      .select('trigger_count')
      .eq('id', responseId)
      .eq('company_id', companyId)
      .single();

    if (currentResponse) {
      const { error: updateError } = await supabase
        .from('auto_responses')
        .update({
          trigger_count: currentResponse.trigger_count + 1,
          last_triggered_at: new Date().toISOString(),
        })
        .eq('id', responseId)
        .eq('company_id', companyId);

      if (updateError) {
        console.error('Error incrementing trigger count:', updateError);
        return NextResponse.json(
          { success: false, error: updateError.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in PATCH /api/automation/auto-responses/[id]:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
