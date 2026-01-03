import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET: Buscar configurações de automação
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    if (!companyId) {
      return NextResponse.json(
        { success: false, error: 'companyId é obrigatório' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('automation_settings')
      .select('*')
      .eq('company_id', companyId)
      .single();

    if (error) {
      // Se não existe configuração, criar uma padrão
      if (error.code === 'PGRST116') {
        const { data: newSettings, error: insertError } = await supabase
          .from('automation_settings')
          .insert({
            company_id: companyId,
            welcome_message: 'Olá! Seja bem-vindo(a). Como posso ajudá-lo(a) hoje?',
            welcome_enabled: false,
            away_message: 'Estou temporariamente ausente. Retornarei em breve.',
            away_enabled: false,
            after_hours_message: 'Estamos fora do horário de atendimento. Nosso horário é de Segunda a Sexta, das 9h às 18h.',
            after_hours_enabled: false,
            auto_assign_enabled: false,
            auto_assign_strategy: 'round_robin',
            availability_status: 'online',
          })
          .select()
          .single();

        if (insertError) {
          console.error('Error creating default settings:', insertError);
          return NextResponse.json(
            { success: false, error: insertError.message },
            { status: 500 }
          );
        }

        return NextResponse.json({ success: true, settings: newSettings });
      }

      console.error('Error fetching automation settings:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, settings: data });
  } catch (error) {
    console.error('Error in GET /api/automation/settings:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// PUT: Atualizar configurações de automação
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { companyId, ...settings } = body;

    if (!companyId) {
      return NextResponse.json(
        { success: false, error: 'companyId é obrigatório' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('automation_settings')
      .update(settings)
      .eq('company_id', companyId)
      .select()
      .single();

    if (error) {
      console.error('Error updating automation settings:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, settings: data });
  } catch (error) {
    console.error('Error in PUT /api/automation/settings:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
