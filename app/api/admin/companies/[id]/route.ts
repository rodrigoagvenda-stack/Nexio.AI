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
  { params }: { params: { id: string } }
) {
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const auth = await verifyAdmin(supabase);

    if ('error' in auth) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const body = await request.json();

    const { data, error } = await auth.serviceSupabase
      .from('companies')
      .update(body)
      .eq('id', params.id)
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const auth = await verifyAdmin(supabase);

    if ('error' in auth) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const { error } = await auth.serviceSupabase
      .from('companies')
      .update({ is_active: false })
      .eq('id', params.id);

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Empresa desativada' });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
