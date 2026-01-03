import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET: Buscar horário comercial
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
      .from('business_hours')
      .select('*')
      .eq('company_id', companyId)
      .order('day_of_week', { ascending: true });

    if (error) {
      console.error('Error fetching business hours:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // Se não existem horários, criar padrão
    if (!data || data.length === 0) {
      const defaultHours = [];
      for (let day = 0; day <= 6; day++) {
        defaultHours.push({
          company_id: companyId,
          day_of_week: day,
          is_enabled: day >= 1 && day <= 5, // Segunda a Sexta
          start_time: '09:00:00',
          end_time: '18:00:00',
          timezone: 'America/Sao_Paulo',
        });
      }

      const { data: newHours, error: insertError } = await supabase
        .from('business_hours')
        .insert(defaultHours)
        .select();

      if (insertError) {
        console.error('Error creating default hours:', insertError);
        return NextResponse.json(
          { success: false, error: insertError.message },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true, hours: newHours });
    }

    return NextResponse.json({ success: true, hours: data });
  } catch (error) {
    console.error('Error in GET /api/automation/business-hours:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// PUT: Atualizar horário comercial (bulk update)
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { companyId, hours } = body;

    if (!companyId || !hours || !Array.isArray(hours)) {
      return NextResponse.json(
        { success: false, error: 'companyId e hours são obrigatórios' },
        { status: 400 }
      );
    }

    // Atualizar cada dia individualmente
    const updates = hours.map((hour) =>
      supabase
        .from('business_hours')
        .update({
          is_enabled: hour.is_enabled,
          start_time: hour.start_time,
          end_time: hour.end_time,
          timezone: hour.timezone || 'America/Sao_Paulo',
        })
        .eq('company_id', companyId)
        .eq('day_of_week', hour.day_of_week)
    );

    const results = await Promise.all(updates);

    const errors = results.filter((r) => r.error);
    if (errors.length > 0) {
      console.error('Error updating business hours:', errors);
      return NextResponse.json(
        { success: false, error: 'Erro ao atualizar horários' },
        { status: 500 }
      );
    }

    // Buscar horários atualizados
    const { data, error } = await supabase
      .from('business_hours')
      .select('*')
      .eq('company_id', companyId)
      .order('day_of_week', { ascending: true });

    if (error) {
      console.error('Error fetching updated hours:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, hours: data });
  } catch (error) {
    console.error('Error in PUT /api/automation/business-hours:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
