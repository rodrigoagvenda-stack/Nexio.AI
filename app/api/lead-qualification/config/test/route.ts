import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Verificar autenticação
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, message: 'Não autorizado' }, { status: 401 });
    }

    // Verificar se é admin
    const { data: adminUser } = await supabase
      .from('admin_users')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (!adminUser) {
      return NextResponse.json({ success: false, message: 'Acesso negado' }, { status: 403 });
    }

    // Buscar configuração
    const { data: config, error: configError } = await supabase
      .from('lead_qualification_config')
      .select('*')
      .single();

    if (configError || !config?.webhook_url) {
      return NextResponse.json(
        { success: false, message: 'Webhook não configurado' },
        { status: 400 }
      );
    }

    // Payload de teste
    const testPayload = {
      event: 'test',
      message: 'Este é um teste do webhook de qualificação de leads Nexio AI',
      timestamp: new Date().toISOString(),
      test_data: {
        nome_completo: 'Teste Nexio',
        email: 'teste@nexio.ai',
        whatsapp: '11999999999',
        nome_empresa: 'Empresa Teste',
        segmento_negocio: 'Tecnologia',
        volume_atendimentos: '50_100',
        principal_gargalo: 'demora_resposta',
        processo_vendas: 'sim_estruturado',
        urgencia: 'curto_prazo',
        budget: '5000_8000',
      },
    };

    let testStatus = 'success';
    let testMessage = 'Webhook testado com sucesso!';

    try {
      const response = await fetch(config.webhook_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-webhook-secret': config.webhook_secret || '',
        },
        body: JSON.stringify(testPayload),
      });

      if (!response.ok) {
        testStatus = 'failed';
        testMessage = `Webhook retornou status ${response.status}`;
      }
    } catch (error: any) {
      testStatus = 'failed';
      testMessage = error.message || 'Erro ao chamar webhook';
    }

    // Atualizar status do teste
    await supabase
      .from('lead_qualification_config')
      .update({
        last_test_at: new Date().toISOString(),
        last_test_status: testStatus,
      })
      .eq('id', config.id);

    return NextResponse.json({
      success: testStatus === 'success',
      message: testMessage,
      status: testStatus,
    });
  } catch (error: any) {
    console.error('Error testing webhook:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Erro ao testar webhook' },
      { status: 500 }
    );
  }
}
