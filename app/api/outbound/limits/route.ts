import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, message: 'Não autorizado' }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from('users')
      .select('company_id')
      .eq('auth_user_id', user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ success: false, message: 'Empresa não encontrada' }, { status: 403 });
    }

    const serviceSupabase = createServiceClient();

    // Achado ao vivo (Rodrigo, 2026-09-09, Grupo Venda) : "outbound_limits"
    // tem UMA linha por lead (company_id + whatsapp), usada pra limitar
    // quantas mensagens aquele lead específico recebe por dia (anti-spam por
    // lead) -- não é um contador agregado da empresa. Pegar só a linha mais
    // recente (como era antes) mostrava o "enviadas hoje" de UM lead só,
    // travado em 1 pra sempre, porque toda mensagem nova pra um lead novo
    // cria outra linha com valor 1 que vira "a mais recente" na hora seguinte.
    // Soma de verdade : todas as linhas resetadas hoje, desta empresa.
    const hoje = new Date().toISOString().split('T')[0];
    const { data, error } = await serviceSupabase
      .from('outbound_limits')
      .select('mensagens_enviadas_hoje, limite_diario, ultimo_reset, created_at')
      .eq('company_id', userData.company_id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const rows = data ?? [];
    const enviadasHoje = rows
      .filter((r) => r.ultimo_reset === hoje)
      .reduce((acc, r) => acc + (r.mensagens_enviadas_hoje ?? 0), 0);
    const limiteDiario = rows[0]?.limite_diario ?? null;

    return NextResponse.json({
      success: true,
      limits: rows.length ? { mensagens_enviadas_hoje: enviadasHoje, limite_diario: limiteDiario } : null,
    });
  } catch (error: any) {
    console.error('outbound limits GET error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, message: 'Não autorizado' }, { status: 401 });
    }

    // company_id sempre do usuário autenticado : nunca do body (previne IDOR)
    const { data: userData } = await supabase
      .from('users')
      .select('company_id, role')
      .eq('auth_user_id', user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ success: false, message: 'Empresa não encontrada' }, { status: 403 });
    }

    if (!['admin', 'company_admin', 'manager'].includes(userData.role ?? '')) {
      return NextResponse.json({ success: false, message: 'Apenas administradores podem alterar limites' }, { status: 403 });
    }

    const body = await request.json();
    const { limite_diario } = body;

    const serviceSupabase = createServiceClient();
    const { error: updateError } = await serviceSupabase
      .from('outbound_limits')
      .update({ limite_diario })
      .eq('company_id', userData.company_id);

    if (updateError) throw updateError;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('outbound limits error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
