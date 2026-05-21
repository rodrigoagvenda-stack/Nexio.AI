import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { createInstance } from '@/lib/uazapi-admin';
import { encrypt } from '@/lib/crypto';
import { requireAuth } from '@/lib/auth/require-auth';

export async function POST(request: NextRequest) {
  const { context, error: authError } = await requireAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json().catch(() => ({}));
    const instanceName = body.name || `empresa-${context.companyId}-${Date.now()}`;

    const service = createServiceClient();

    // Verificar se já tem instância ativa
    const { data: existing } = await service
      .from('sdr_configs')
      .select('id, instance_status')
      .eq('company_id', context.companyId)
      .single();

    if (existing?.instance_status === 'connected') {
      return NextResponse.json({ error: 'Já existe uma instância conectada' }, { status: 400 });
    }

    // Criar instância via UAZapi admin API
    const instance = await createInstance({
      name: instanceName,
      companyId: context.companyId,
    });

    const baseUrl = process.env.UAZAPI_BASE_URL || 'https://nexioai.uazapi.com';
    const encryptedToken = encrypt(instance.token);

    // Salvar ou atualizar sdr_configs
    if (existing) {
      await service.from('sdr_configs').update({
        uazapi_instance_url: baseUrl,
        uazapi_instance_name: instanceName,
        uazapi_token: encryptedToken,
        instance_status: 'disconnected',
        instance_phone: null,
      }).eq('company_id', context.companyId);
    } else {
      const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/sdr/webhook/${context.companyId}`;
      await service.from('sdr_configs').insert({
        company_id: context.companyId,
        uazapi_instance_url: baseUrl,
        uazapi_instance_name: instanceName,
        uazapi_token: encryptedToken,
        instance_status: 'disconnected',
        webhook_url: webhookUrl,
        agent_type: 'atendimento_venda',
        agente_ativo: false,
      });
    }

    // Atualizar whatsapp_instance_name na companies
    await service.from('companies').update({
      whatsapp_instance_name: instanceName,
      whatsapp_instance: baseUrl,
    }).eq('id', context.companyId);

    return NextResponse.json({
      success: true,
      instance: {
        name: instanceName,
        status: 'disconnected',
        token: '••••••••',
      },
    });
  } catch (err: any) {
    console.error('[instance/create]', err);
    return NextResponse.json({ error: err.message || 'Erro ao criar instância' }, { status: 500 });
  }
}
