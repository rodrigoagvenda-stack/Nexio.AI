import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Verificar autenticação admin
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, message: 'Não autorizado' }, { status: 401 });
    }

    // Usar service client para bypassa RLS
    const serviceSupabase = createServiceClient();

    const { data: adminUser } = await serviceSupabase
      .from('admin_users')
      .select('*')
      .eq('auth_user_id', user.id)
      .eq('is_active', true)
      .single();

    if (!adminUser) {
      return NextResponse.json({ success: false, message: 'Acesso negado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const type      = searchParams.get('type');
    const severity  = searchParams.get('severity');
    const fromDate  = searchParams.get('from_date');
    const toDate    = searchParams.get('to_date');
    const companyId = searchParams.get('company_id');
    const limit     = parseInt(searchParams.get('limit') || '200');

    let query = serviceSupabase
      .from('system_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (type && type !== 'all')       query = query.eq('type', type);
    if (severity && severity !== 'all') query = query.eq('severity', severity);
    if (fromDate)                     query = query.gte('created_at', fromDate);
    if (toDate)                       query = query.lte('created_at', toDate);
    if (companyId)                    query = query.eq('company_id', parseInt(companyId));

    const { data, error } = await query;

    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return NextResponse.json({
          success: true,
          data: [],
          table_missing: true,
          message: 'Tabela system_logs não encontrada — execute a migration 20260504000000_system_logs.sql no Supabase.',
        });
      }
      throw error;
    }

    return NextResponse.json({ success: true, data: data || [], table_missing: false });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, message: 'Não autorizado' }, { status: 401 });
    }

    const serviceSupabase = createServiceClient();
    const body = await request.json();

    // company_id sempre da sessão — nunca do body para evitar log injection entre empresas
    const { data: dbUser } = await serviceSupabase
      .from('users')
      .select('company_id, role')
      .eq('auth_user_id', user.id)
      .single();

    // Usuários comuns só podem registrar severidade info/warning — não podem forjar erros críticos
    const ADMIN_ROLES = ['admin', 'company_admin', 'manager'];
    const allowedSeverities: string[] = ADMIN_ROLES.includes(dbUser?.role ?? '')
      ? ['debug', 'info', 'warning', 'error', 'critical']
      : ['debug', 'info', 'warning'];
    const severity = allowedSeverities.includes(body.severity) ? body.severity : 'info';

    const logData = {
      type: body.type,
      severity,
      message: body.message,
      metadata: body.metadata,
      company_id: dbUser?.company_id ?? null,
      user_id: user.id,
    };

    const { data, error } = await serviceSupabase
      .from('system_logs')
      .insert([logData])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
