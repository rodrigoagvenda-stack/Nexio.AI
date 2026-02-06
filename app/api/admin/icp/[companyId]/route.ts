import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

async function verifyAdmin(supabase: any) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Não autorizado', status: 401 };
  }

  const serviceSupabase = createServiceClient();
  const { data: adminUser } = await serviceSupabase
    .from('admin_users')
    .select('*')
    .eq('auth_user_id', user.id)
    .eq('is_active', true)
    .single();

  if (!adminUser) {
    return { error: 'Acesso negado', status: 403 };
  }

  return { user, adminUser, serviceSupabase };
}

export async function GET(
  request: NextRequest,
  { params }: { params: { companyId: string } }
) {
  try {
    const supabase = await createClient();
    const auth = await verifyAdmin(supabase);

    if ('error' in auth) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const { data, error } = await auth.serviceSupabase
      .from('icp_configuration')
      .select('*')
      .eq('company_id', params.companyId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    return NextResponse.json({ success: true, data: data || null });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { companyId: string } }
) {
  try {
    const supabase = await createClient();
    const auth = await verifyAdmin(supabase);

    if ('error' in auth) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const body = await request.json();

    // Sanitizar arrays - remover strings vazias e garantir que arrays vazios sejam null
    const sanitizeArray = (arr: any) => {
      if (!arr || !Array.isArray(arr)) return null;
      const filtered = arr.filter((item: any) => item && item.trim && item.trim() !== '');
      return filtered.length > 0 ? filtered : null;
    };

    // Sanitizar números
    const sanitizeNumber = (num: any) => {
      if (num === null || num === undefined || num === '' || isNaN(num)) return null;
      return Number(num);
    };

    // Sanitizar strings
    const sanitizeString = (str: any) => {
      if (!str || (typeof str === 'string' && str.trim() === '')) return null;
      return str;
    };

    // Limpar e preparar dados (somente colunas que EXISTEM no banco)
    const cleanedData = {
      idade_min: sanitizeNumber(body.idade_min),
      idade_max: sanitizeNumber(body.idade_max),
      renda_min: sanitizeNumber(body.renda_min),
      renda_max: sanitizeNumber(body.renda_max),
      genero: sanitizeString(body.genero),
      escolaridade: sanitizeString(body.escolaridade),
      estados: sanitizeArray(body.estados),
      nichos: sanitizeArray(body.nichos),
      tamanho_empresas: sanitizeString(body.tamanho_empresas),
      tempo_mercado: sanitizeString(body.tempo_mercado),
      empresa_funcionarios: sanitizeNumber(body.empresa_funcionarios),
      canais: sanitizeArray(body.canais),
      preferencia_contato: sanitizeString(body.preferencia_contato),
      horario: sanitizeString(body.horario),
      linguagem: sanitizeString(body.linguagem),
      ciclo_compra: sanitizeString(body.ciclo_compra),
      comprou_online: body.comprou_online === true,
      influenciador: body.influenciador === true,
      budget_min: sanitizeNumber(body.budget_min),
      budget_max: sanitizeNumber(body.budget_max),
      dores: sanitizeString(body.dores),
      objetivos: sanitizeString(body.objetivos),
      leads_por_dia_max: sanitizeNumber(body.leads_por_dia_max) || 3,
      usar_ia: body.usar_ia === true,
      entregar_fins_semana: body.entregar_fins_semana === true,
      notificar_novos_leads: body.notificar_novos_leads !== false,
      prioridade: sanitizeString(body.prioridade) || 'Média',
    };

    // Verificar se já existe configuração
    const { data: existing } = await auth.serviceSupabase
      .from('icp_configuration')
      .select('*')
      .eq('company_id', params.companyId)
      .single();

    let data, error;

    if (existing) {
      // Atualizar
      ({ data, error } = await auth.serviceSupabase
        .from('icp_configuration')
        .update({ ...cleanedData, updated_at: new Date().toISOString() })
        .eq('company_id', params.companyId)
        .select()
        .single());
    } else {
      // Criar
      ({ data, error } = await auth.serviceSupabase
        .from('icp_configuration')
        .insert([{ ...cleanedData, company_id: parseInt(params.companyId) }])
        .select()
        .single());
    }

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'ICP configurado com sucesso!',
      data,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
