import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

// GET: Buscar config + perguntas da empresa pelo slug (para renderizar o formulário público)
export async function GET(
  _request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const service = createServiceClient();

    const { data: config, error: configError } = await service
      .from('briefing_company_config')
      .select('id, company_id, slug, is_active, primary_color, theme, logo_url, title, description, success_message, whatsapp_required, whatsapp_label, whatsapp_order_index')
      .eq('slug', params.slug)
      .eq('is_active', true)
      .single();

    if (configError || !config) {
      return NextResponse.json(
        { success: false, message: 'Briefing não encontrado ou inativo' },
        { status: 404 }
      );
    }

    const { data: questions, error: questionsError } = await service
      .from('briefing_questions')
      .select('id, label, field_key, question_type, options, is_required, order_index')
      .eq('company_id', config.company_id)
      .order('order_index', { ascending: true });

    if (questionsError) throw questionsError;

    return NextResponse.json({
      success: true,
      data: { config, questions: questions || [] },
    });
  } catch (error: any) {
    console.error('Error fetching briefing:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Erro ao carregar briefing' },
      { status: 500 }
    );
  }
}

// POST: Receber respostas do briefing
export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const supabase = createServiceClient();
    const body = await request.json();
    const { answers } = body;

    if (!answers || typeof answers !== 'object') {
      return NextResponse.json(
        { success: false, message: 'Respostas inválidas' },
        { status: 400 }
      );
    }

    // Buscar config da empresa
    const { data: config, error: configError } = await supabase
      .from('briefing_company_config')
      .select('id, company_id, is_active, webhook_url')
      .eq('slug', params.slug)
      .eq('is_active', true)
      .single();

    if (configError || !config) {
      return NextResponse.json(
        { success: false, message: 'Briefing não encontrado ou inativo' },
        { status: 404 }
      );
    }

    const webhookUrl = config.webhook_url || null;

    // Buscar lead pelo WhatsApp (se disponível nas respostas)
    let leadId: number | null = null;
    const whatsappNumber = answers['whatsapp'] || null;
    if (whatsappNumber) {
      const { data: lead } = await supabase
        .from('leads')
        .select('id')
        .eq('company_id', config.company_id)
        .eq('whatsapp', whatsappNumber)
        .maybeSingle();

      if (lead) {
        leadId = lead.id;
        // Marcar briefing como preenchido
        await supabase
          .from('leads')
          .update({ briefing_preenchido: true, briefing_preenchido_em: new Date().toISOString() })
          .eq('id', leadId);
      }
    }

    // Salvar resposta
    const { data: response, error: responseError } = await supabase
      .from('briefing_mt_responses')
      .insert({
        company_id: config.company_id,
        answers,
        submitted_at: new Date().toISOString(),
        webhook_sent: false,
      })
      .select()
      .single();

    if (responseError) throw responseError;
    if (!response) throw new Error('Falha ao salvar resposta no banco de dados');

    // Disparar webhook
    if (webhookUrl) {
      console.log('[Briefing] Disparando webhook para:', webhookUrl);
      const webhookRes = await Promise.race([
        fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            briefing_response_id: response.id,
            company_id: config.company_id,
            slug: params.slug,
            lead_id: leadId,
            answers,
            submitted_at: response.submitted_at,
          }),
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('webhook timeout após 8s')), 8000)
        ),
      ]);

      if (!webhookRes.ok) {
        const errText = await webhookRes.text();
        throw new Error(`Webhook retornou erro ${webhookRes.status}: ${errText.substring(0, 200)}`);
      }

      await supabase
        .from('briefing_mt_responses')
        .update({ webhook_sent: true, webhook_sent_at: new Date().toISOString() })
        .eq('id', response.id);

      console.log('[Briefing] Webhook disparado com sucesso, status:', webhookRes.status);
    } else {
      console.warn('[Briefing] Nenhum webhook_url configurado para slug:', params.slug);
    }

    return NextResponse.json({
      success: true,
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
