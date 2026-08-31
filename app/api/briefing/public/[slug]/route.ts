import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/rate-limit';
import { sendRichStepUnified } from '@/lib/sdr/rich-sender';
import { gravarMensagemFollow } from '@/lib/sdr/follow';
import { normalizePhone } from '@/lib/sdr/uazapi';

// Status que já avançaram além de "qualificação" : preencher o briefing não
// deve regredir um lead que já fechou, perdeu ou já está em proposta.
const STATUS_NAO_REGREDIR = new Set(['Fechado', 'Perdido', 'Proposta enviada']);

function extrairEmailDasRespostas(answers: Record<string, unknown>): string | null {
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  for (const v of Object.values(answers)) {
    if (typeof v === 'string' && EMAIL_RE.test(v.trim())) return v.trim();
  }
  return null;
}

// GET: Buscar config + perguntas da empresa pelo slug (para renderizar o formulário público)
export async function GET(_request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const ip = _request.headers.get('x-forwarded-for') ?? 'unknown'
  const rl = rateLimit({ key: `briefing-public:${ip}`, limit: 20, windowMs: 60_000 })
  if (!rl.success) return NextResponse.json({ error: 'Muitas requisições' }, { status: 429 })

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
export async function POST(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
  const rl = rateLimit({ key: `briefing-public:${ip}`, limit: 20, windowMs: 60_000 })
  if (!rl.success) return NextResponse.json({ error: 'Muitas requisições' }, { status: 429 })

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
      .select('id, company_id, is_active, webhook_url, success_message')
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

    // Buscar lead pelo WhatsApp (normalização universal: strip não-dígitos, compara últimos 8)
    let leadId: number | null = null;
    const whatsappRaw = answers['whatsapp'] || null;
    if (whatsappRaw) {
      const { data: leadRows } = await supabase
        .rpc('match_lead_by_phone', {
          company_id_param: config.company_id,
          phone_param: whatsappRaw,
        });

      const lead = leadRows?.[0] ?? null;
      if (lead) {
        leadId = lead.id;
        const email = extrairEmailDasRespostas(answers);
        await supabase
          .from('leads')
          .update({
            briefing_preenchido: true,
            briefing_preenchido_em: new Date().toISOString(),
            ...(email ? { email } : {}),
          })
          .eq('id', leadId);

        // Fecha o loop form → conversa → follow-up : sem isso o SDR só sabia
        // do briefing se o lead escrevesse de novo (reativo). Agora reage na
        // hora do envio (proativo), grava estado permanente no checklist da
        // conversa (não depende de janela de histórico) e reaproveita o
        // motor de follow-up já existente via mudança de status.
        try {
          const { data: leadRow } = await supabase
            .from('leads')
            .select('contact_name, status')
            .eq('id', leadId)
            .single();

          // Não regride lead que já avançou além de qualificação
          if (leadRow && !STATUS_NAO_REGREDIR.has(leadRow.status)) {
            await supabase.from('leads').update({ status: 'Interessado' }).eq('id', leadId);
          }

          const phone = normalizePhone(whatsappRaw);

          // Checklist estruturado da conversa (conversas_do_whatsapp.checklist_atendimento) :
          // mesmo campo que o orquestrador do SDR já lê e prioriza sobre reler histórico.
          const { data: conv } = await supabase
            .from('conversas_do_whatsapp')
            .select('id, checklist_atendimento')
            .eq('company_id', config.company_id)
            .eq('id_do_lead', leadId)
            .order('hora_da_ultima_mensagem', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (conv?.id) {
            const checklistAtual = (conv.checklist_atendimento as Record<string, unknown>) ?? {};
            await supabase
              .from('conversas_do_whatsapp')
              .update({ checklist_atendimento: { ...checklistAtual, estagio_atual: 'formulario_preenchido' } })
              .eq('id', conv.id);
          }

          // Mensagem proativa : reaproveita o texto de sucesso já configurado
          // pela empresa pra tela do formulário, se existir.
          const nome = leadRow?.contact_name?.split(' ')[0];
          const mensagem = (config.success_message?.trim())
            || `Parabéns${nome ? `, ${nome}` : ''}! Recebi suas respostas. Já vou te confirmar os próximos passos por aqui.`;

          await sendRichStepUnified(config.company_id, phone, 'text', mensagem);
          await gravarMensagemFollow(leadId, config.company_id, phone, mensagem, 'briefing', supabase);
        } catch (err: any) {
          // Melhor esforço : falha aqui não pode derrubar o envio do formulário em si
          console.error('[Briefing] Falha ao dar continuidade (checklist/mensagem/status):', err?.message);
        }
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
