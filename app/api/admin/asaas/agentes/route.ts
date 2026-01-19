import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { generateWebhookId, generateWebhookSecret } from '@/lib/crypto';

// GET /api/admin/asaas/agentes
export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const { data: adminUser } = await supabase
      .from('admin_users')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (!adminUser) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const { data: agentes, error } = await supabase
      .from('asaas_agentes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    // Conta cobranças por agente
    const agentesComContagem = await Promise.all(
      (agentes || []).map(async (agente) => {
        const { count } = await supabase
          .from('asaas_cobrancas')
          .select('*', { count: 'exact', head: true })
          .eq('agente_id', agente.id);

        return {
          ...agente,
          cobrancas_count: count || 0,
        };
      })
    );

    return NextResponse.json({ agentes: agentesComContagem });
  } catch (error: any) {
    console.error('Erro ao buscar agentes:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar agentes' },
      { status: 500 }
    );
  }
}

// POST /api/admin/asaas/agentes
export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const { data: adminUser } = await supabase
      .from('admin_users')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (!adminUser) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const body = await request.json();
    const { name } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Nome é obrigatório' },
        { status: 400 }
      );
    }

    // Gera webhook ID e secret
    const webhookId = generateWebhookId();
    const webhookSecret = generateWebhookSecret();

    const { data, error } = await supabase
      .from('asaas_agentes')
      .insert({
        name,
        webhook_id: webhookId,
        webhook_secret: webhookSecret,
        active: true,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const webhookUrl = `${baseUrl}/api/webhooks/asaas/${webhookId}`;

    return NextResponse.json({
      agente: {
        ...data,
        webhook_url: webhookUrl,
      },
    });
  } catch (error: any) {
    console.error('Erro ao criar agente:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao criar agente' },
      { status: 500 }
    );
  }
}
