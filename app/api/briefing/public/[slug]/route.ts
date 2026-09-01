import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/rate-limit';
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

// Heurística por chave (field_key), igual extrairEmailDasRespostas é por
// formato : o Briefing é genérico por empresa, cada uma define suas próprias
// perguntas/chaves, não dá pra saber de antemão qual é "a pergunta do nome".
function extrairNomeDasRespostas(answers: Record<string, unknown>): string | null {
  for (const [key, v] of Object.entries(answers)) {
    if (typeof v === 'string' && v.trim() && /nome|name/i.test(key)) return v.trim();
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

      let lead = leadRows?.[0] ?? null;
      const email = extrairEmailDasRespostas(answers);

      if (lead && lead.id != null) {
        const currentLeadId: number = lead.id;
        leadId = currentLeadId;
        await supabase
          .from('leads')
          .update({
            briefing_preenchido: true,
            briefing_preenchido_em: new Date().toISOString(),
            ...(email ? { email } : {}),
          })
          .eq('id', currentLeadId);
      } else {
        // Ninguém preenchendo pela primeira vez ainda tem lead no CRM (ex: veio
        // direto de um anúncio pro formulário, sem passar pelo SDR antes).
        // Cria na hora : sem isso a resposta ficava órfã, sem status/checklist
        // e sem lead_id pro webhook disparar follow-up nenhum.
        const nome = extrairNomeDasRespostas(answers);
        const { data: novoLead } = await supabase
          .from('leads')
          .insert({
            company_id: config.company_id,
            company_name: nome || 'Lead via formulário',
            contact_name: nome,
            whatsapp: normalizePhone(whatsappRaw),
            email,
            status: 'Interessado',
            origem: 'inbound',
            briefing_preenchido: true,
            briefing_preenchido_em: new Date().toISOString(),
          })
          .select('id')
          .single();
        if (novoLead?.id != null) {
          lead = novoLead;
          leadId = novoLead.id;
        }
      }

      if (lead && lead.id != null) {
        const currentLeadId: number = lead.id;

        // Fecha o loop form → conversa → follow-up : sem isso o SDR só sabia
        // do briefing se o lead escrevesse de novo (reativo). Agora reage na
        // hora do envio (proativo), grava estado permanente no checklist da
        // conversa (não depende de janela de histórico) e reaproveita o
        // motor de follow-up já existente via mudança de status.
        try {
          const { data: leadRow } = await supabase
            .from('leads')
            .select('contact_name, status')
            .eq('id', currentLeadId)
            .single();

          // Não regride lead que já avançou além de qualificação
          if (leadRow && !STATUS_NAO_REGREDIR.has(leadRow.status)) {
            await supabase.from('leads').update({ status: 'Interessado' }).eq('id', currentLeadId);
          }

          // Checklist estruturado da conversa (conversas_do_whatsapp.checklist_atendimento) :
          // mesmo campo que o orquestrador do SDR já lê e prioriza sobre reler histórico.
          const { data: conv } = await supabase
            .from('conversas_do_whatsapp')
            .select('id, checklist_atendimento')
            .eq('company_id', config.company_id)
            .eq('id_do_lead', currentLeadId)
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

          // Mensagem de WhatsApp pró-ativa NÃO é mais enviada daqui : "Mensagem
          // final" é só texto de tela (config.success_message, usado em
          // app/briefing/[slug]/page.tsx). Quem manda WhatsApp de continuidade
          // agora é a sequência ligada ao gatilho "Evento de webhook"
          // (config.webhook_url), configurável no canvas — evita duplicar
          // mensagem quando as duas coisas disparavam juntas.
        } catch (err: any) {
          // Melhor esforço : falha aqui não pode derrubar o envio do formulário em si
          console.error('[Briefing] Falha ao dar continuidade (checklist/status):', err?.message);
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

    // Disparar webhook : melhor esforço, igual ao bloco de checklist/mensagem
    // acima. O formulário já foi salvo (insert acima) : uma falha aqui (rede,
    // timeout, webhook mal configurado) não pode derrubar a tela de sucesso
    // de quem preencheu, senão perde a resposta pro lead por um problema que
    // é só nosso/da automação, não dele.
    if (webhookUrl) {
      try {
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
      } catch (err: any) {
        console.error('[Briefing] Falha ao disparar webhook (não derruba o envio):', err?.message);
      }
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
