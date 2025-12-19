import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.json();

    // Validar dados obrigatórios
    const required = ['nome_responsavel', 'email', 'whatsapp', 'nome_empresa', 'segmento', 'tempo_mercado', 'investe_marketing', 'faturamento', 'budget'];
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
      .from('briefing_responses')
      .insert([formData])
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting briefing:', insertError);
      throw insertError;
    }

    // 2. Buscar configuração do webhook
    const { data: config, error: configError } = await supabase
      .from('briefing_config')
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
            event: 'briefing_completed',
            response_id: response.id,
            submitted_at: response.submitted_at,
            ...formData,
          }),
        });

        // Marcar como enviado
        await supabase
          .from('briefing_responses')
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
      message: 'Briefing enviado com sucesso!',
    });
  } catch (error: any) {
    console.error('Error submitting briefing:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Erro ao enviar briefing' },
      { status: 500 }
    );
  }
}
