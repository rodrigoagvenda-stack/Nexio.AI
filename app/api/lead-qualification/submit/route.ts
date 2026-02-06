import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.json();

    // Validar dados obrigatórios
    const required = [
      'nome_completo',
      'whatsapp',
      'email',
      'nome_empresa',
      'segmento_negocio',
      'volume_atendimentos',
      'principal_gargalo',
      'processo_vendas',
      'urgencia',
      'budget',
    ];

    for (const field of required) {
      if (!formData[field]) {
        return NextResponse.json(
          { success: false, message: `Campo obrigatório: ${field}` },
          { status: 400 }
        );
      }
    }

    const supabase = createServiceClient();

    // 1. Salvar no banco
    const { data: response, error: insertError } = await supabase
      .from('lead_qualification_responses')
      .insert([{
        nome_completo: formData.nome_completo,
        whatsapp: formData.whatsapp,
        country_code: formData.country_code || '+55',
        email: formData.email,
        nome_empresa: formData.nome_empresa,
        segmento_negocio: formData.segmento_negocio,
        volume_atendimentos: formData.volume_atendimentos,
        principal_gargalo: formData.principal_gargalo,
        dor_principal: formData.dor_principal,
        processo_vendas: formData.processo_vendas,
        ticket_medio: formData.ticket_medio,
        pessoas_comercial: formData.pessoas_comercial,
        urgencia: formData.urgencia,
        budget: formData.budget,
      }])
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting lead qualification:', insertError);
      throw insertError;
    }

    // 2. Buscar configuração do webhook
    const { data: config, error: configError } = await supabase
      .from('lead_qualification_config')
      .select('webhook_url, webhook_secret, is_active')
      .single();

    if (!configError && config?.is_active && config?.webhook_url) {
      // 3. Chamar webhook
      try {
        await fetch(config.webhook_url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-webhook-secret': config.webhook_secret || '',
          },
          body: JSON.stringify({
            event: 'lead_qualification_completed',
            response_id: response.id,
            submitted_at: response.submitted_at,
            ...formData,
          }),
        });

        // Marcar como enviado
        await supabase
          .from('lead_qualification_responses')
          .update({ webhook_sent: true, webhook_sent_at: new Date().toISOString() })
          .eq('id', response.id);
      } catch (webhookError) {
        console.error('Webhook call failed:', webhookError);
        // Não falhar a request se o webhook falhar
      }
    }

    return NextResponse.json({
      success: true,
      response_id: response.id,
      message: 'Formulário enviado com sucesso!',
    });
  } catch (error: any) {
    console.error('Error submitting lead qualification:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Erro ao enviar formulário' },
      { status: 500 }
    );
  }
}
