import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireAuth, validateCompanyAccess } from '@/lib/auth/require-auth';
import { gtproConvertLead } from '@/lib/meta/gtpro';
import { fireMetaCapiEvent } from '@/lib/meta/capi';

export async function PATCH(request: NextRequest, props: { params: Promise<{ leadId: string }> }) {
  const params = await props.params;
  const { context, error: authError } = await requireAuth(request);
  if (authError) return authError;

  try {
    const { leadId } = params;
    const body = await request.json();
    const { companyId, field, value } = body;

    if (!leadId || !companyId || !field) {
      return NextResponse.json({ success: false, message: 'Dados obrigatórios faltando' }, { status: 400 });
    }

    const accessError = validateCompanyAccess(parseInt(companyId), context.companyId);
    if (accessError) return accessError;

    const supabase = createServiceClient();

    const allowedFields = [
      'segment', 'priority', 'status', 'nivel_interesse', 'import_source',
      'cargo', 'project_value', 'company_name', 'contact_name', 'whatsapp',
      'email', 'website_or_instagram', 'notes', 'mql_resumo',
    ];

    if (!allowedFields.includes(field)) {
      return NextResponse.json({ success: false, message: `Campo '${field}' não é editável` }, { status: 400 });
    }

    const updateData: any = { [field]: value, updated_at: new Date().toISOString() };

    if (field === 'status' && value === 'Fechado') {
      updateData.closed_at = new Date().toISOString();
      // Dispara conversão CAPI no GTPRO em background
      ;(async () => {
        try {
          const { data: leadMeta } = await supabase
            .from('leads')
            .select('meta_attribution, project_value')
            .eq('id', leadId)
            .single()
          const gtproLeadId = (leadMeta?.meta_attribution as any)?.gtpro_lead_id
          if (!gtproLeadId) return
          const { data: sdrcfg } = await supabase
            .from('sdr_configs')
            .select('gtpro_api_key')
            .eq('company_id', context.companyId)
            .maybeSingle()
          if (!sdrcfg?.gtpro_api_key) return
          await gtproConvertLead(sdrcfg.gtpro_api_key, gtproLeadId, {
            value: leadMeta?.project_value ?? undefined,
          })
        } catch {}
      })()

      // Dispara conversão pra Meta Conversions API em background : manda
      // sempre que tiver telefone, com ou sem ctwa_clid (prática padrão :
      // ver commit). Provider independente do GTPRO acima.
      ;(async () => {
        try {
          const { data: leadRow } = await supabase
            .from('leads')
            .select('whatsapp, project_value')
            .eq('id', leadId)
            .single()
          if (!leadRow?.whatsapp) return
          await fireMetaCapiEvent(supabase, {
            companyId: context.companyId,
            phone: leadRow.whatsapp,
            valueCents: leadRow.project_value ? Math.round(leadRow.project_value * 100) : null,
            eventIdSeed: `lead_${leadId}`,
          })
        } catch (e: any) {
          console.warn('[CAPI] falha ao disparar evento pra lead fechado:', e.message)
        }
      })()
    }
    if (field === 'status' && value !== 'Fechado') updateData.closed_at = null;

    if (field === 'status' && value === 'Outbound') {
      await supabase.from('outbound_campaigns').delete().eq('campaign_id', parseInt(leadId));
    }

    if (field === 'status' && value === 'Remarketing') {
      const { data: lead } = await supabase
        .from('leads')
        .select('contact_name')
        .eq('id', leadId)
        .single();

      const { data: existing } = await supabase
        .from('follow_sequences')
        .select('id')
        .eq('company_id', context.companyId)
        .eq('tipo', 'remarketing')
        .ilike('nome', `%[Lead #${leadId}]%`)
        .maybeSingle();

      if (!existing) {
        const nome = lead?.contact_name
          ? `Remarketing : ${lead.contact_name} [Lead #${leadId}]`
          : `Remarketing [Lead #${leadId}]`;

        // Próxima hora cheia como horário padrão
        const nextHour = new Date();
        nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
        const horario = `${String(nextHour.getHours()).padStart(2, '0')}:00`;

        const { data: seq, error: seqErr } = await supabase
          .from('follow_sequences')
          .insert({ company_id: context.companyId, nome, tipo: 'remarketing', ativo: false })
          .select()
          .single();

        if (!seqErr && seq) {
          await supabase.from('follow_steps').insert({
            sequence_id: seq.id,
            dia_offset: 0,
            horario,
            mensagem: '',
            tipo_mensagem: 'text',
            usar_ia: false,
            usar_contexto_sdr: false,
            ordem: 0,
          });
        }
      }
    }

    const { data, error } = await supabase
      .from('leads')
      .update(updateData)
      .eq('id', leadId)
      .eq('company_id', context.companyId)
      .select()
      .single();

    if (error) throw error;
    if (!data) return NextResponse.json({ success: false, message: 'Lead não encontrado' }, { status: 404 });

    return NextResponse.json({ success: true, message: `Campo '${field}' atualizado com sucesso`, data });
  } catch (error: any) {
    console.error('Error updating lead field:', error);
    return NextResponse.json({ success: false, message: error.message || 'Erro ao atualizar lead' }, { status: 500 });
  }
}

export async function GET(request: NextRequest, props: { params: Promise<{ leadId: string }> }) {
  const params = await props.params;
  const { context, error: authError } = await requireAuth(request);
  if (authError) return authError;

  try {
    const { leadId } = params;
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .eq('company_id', context.companyId)
      .single();

    if (error) throw error;
    if (!data) return NextResponse.json({ success: false, message: 'Lead não encontrado' }, { status: 404 });

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Error fetching lead:', error);
    return NextResponse.json({ success: false, message: error.message || 'Erro ao buscar lead' }, { status: 500 });
  }
}
