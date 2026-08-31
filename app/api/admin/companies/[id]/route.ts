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

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const supabase = await createClient();
    const auth = await verifyAdmin(supabase);

    if ('error' in auth) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const { data, error } = await auth.serviceSupabase
      .from('companies')
      .select('*')
      .eq('id', params.id)
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

export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const supabase = await createClient();
    const auth = await verifyAdmin(supabase);

    if ('error' in auth) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const body = await request.json();

    // Filtrar apenas campos válidos da tabela companies
    const allowedFields = [
      'name', 'email', 'phone', 'image_url',
      'plan_type', 'plan_name', 'plan_price',
      'plan_id', 'plan_monthly_limit',
      'leads_extracted_this_month', 'last_extraction_month',
      'whatsapp_instance', 'whatsapp_token',
      'webhook_maps_url', 'webhook_maps_enabled',
      'webhook_whatsapp_url', 'webhook_whatsapp_enabled',
      'is_active', 'subscription_expires_at', 'trial_ends_at', 'trial_enabled', 'allow_uazapi', 'features',
      'asaas_customer_id', 'asaas_cpf_cnpj', 'asaas_subscription_id', 'subscription_start_date',
    ];

    const updateData: Record<string, any> = {};
    for (const key of allowedFields) {
      if (key in body) {
        updateData[key] = body[key];
      }
    }

    // allow_uazapi aqui é o seletor de provider ativo (não só uma permissão) :
    // liga = a empresa passa a usar uazapi, desliga = volta pro padrão Meta.
    // Só mexe em sdr_configs quando o valor realmente mudou nesse save, senão
    // qualquer salvamento não relacionado (ex: trocar nome) desconectaria uma
    // empresa que já está de verdade conectada via Meta.
    let providerSync: 'uazapi' | 'meta' | null = null;
    if ('allow_uazapi' in updateData) {
      const { data: before } = await auth.serviceSupabase
        .from('companies')
        .select('allow_uazapi')
        .eq('id', params.id)
        .single();
      if ((before?.allow_uazapi ?? true) !== updateData.allow_uazapi) {
        providerSync = updateData.allow_uazapi ? 'uazapi' : 'meta';
      }
    }

    const { data, error } = await auth.serviceSupabase
      .from('companies')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single();

    if (error) throw error;

    if (providerSync) {
      await auth.serviceSupabase
        .from('sdr_configs')
        .update({ whatsapp_provider: providerSync })
        .eq('company_id', params.id);
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const supabase = await createClient();
    const auth = await verifyAdmin(supabase);

    if ('error' in auth) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const { id } = await Promise.resolve(params);

    const { error } = await auth.serviceSupabase
      .from('companies')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Empresa deletada' });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
