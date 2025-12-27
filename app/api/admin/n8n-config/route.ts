import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    let query = supabase.from('n8n_webhook_config').select('*');

    if (type) {
      query = query.eq('webhook_type', type);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ success: true, data });
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
    const body = await request.json();
    const { webhook_type, webhook_url, auth_type, auth_username, auth_password, auth_token } = body;

    if (!webhook_type || !webhook_url) {
      return NextResponse.json(
        { success: false, message: 'webhook_type e webhook_url são obrigatórios' },
        { status: 400 }
      );
    }

    // Verificar se já existe
    const { data: existing } = await supabase
      .from('n8n_webhook_config')
      .select('*')
      .eq('webhook_type', webhook_type)
      .single();

    let data, error;

    if (existing) {
      // Atualizar
      ({ data, error } = await supabase
        .from('n8n_webhook_config')
        .update({
          webhook_url,
          auth_type: auth_type || 'basic',
          auth_username,
          auth_password,
          auth_token,
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq('webhook_type', webhook_type)
        .select()
        .single());
    } else {
      // Criar
      ({ data, error } = await supabase
        .from('n8n_webhook_config')
        .insert([{
          webhook_type,
          webhook_url,
          auth_type: auth_type || 'basic',
          auth_username,
          auth_password,
          auth_token,
          is_active: true,
        }])
        .select()
        .single());
    }

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'Webhook configurado com sucesso!',
      data,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
