/**
 * Auditoria de saída para os envios que NÃO passam pelo orquestrador (follow-up, remarketing, anti no-show, outbound, funil).
 *
 * Roda a mesma guarda do SDR (output-guard.ts) só em modo REGISTRO: grava as violações em sdr_logs
 * (event_type 'output_guard_violation', modo 'registro') e não altera o texto. Motivo: esses textos são templates
 * escritos pelo dono da empresa; cortar frase de template sem ele decidir (ex.: "R$ 1.125" no follow de preço da
 * Grupo Venda) seria mudar a oferta dele em silêncio. A decisão de bloquear passa pelo validador ao salvar o template.
 */
import { createServiceClient } from '@/lib/supabase/server'
import { guardOutput, mentionsGratuito, type GuardContext, type GuardRules } from './output-guard'

type Supabase = ReturnType<typeof createServiceClient>

export async function auditarSaidaAutomacao(
  p: {
    companyId: number
    leadId?: number | null
    conversationId?: string | number | null
    phone?: string | null
    text: string
    source: string
  },
  supabase: Supabase,
): Promise<void> {
  try {
    if (!p.text?.trim() || !p.conversationId) return

    const { data: company } = await supabase.from('companies').select('features').eq('id', p.companyId).maybeSingle()
    const rules = ((company?.features ?? {}) as { sdr_output_rules?: GuardRules }).sdr_output_rules

    const [recent, first, total] = await Promise.all([
      supabase
        .from('mensagens_do_whatsapp')
        .select('texto_da_mensagem')
        .eq('id_da_conversacao', p.conversationId)
        .eq('direcao', 'outbound')
        .order('carimbo_de_data_e_hora', { ascending: false })
        .limit(60),
      supabase
        .from('mensagens_do_whatsapp')
        .select('texto_da_mensagem')
        .eq('id_da_conversacao', p.conversationId)
        .eq('direcao', 'outbound')
        .order('carimbo_de_data_e_hora', { ascending: true })
        .limit(3),
      supabase
        .from('mensagens_do_whatsapp')
        .select('id', { count: 'exact', head: true })
        .eq('id_da_conversacao', p.conversationId)
        .eq('direcao', 'outbound'),
    ])
    if (recent.error || first.error || total.error) return

    const texts = (recent.data ?? []).map((m) => m.texto_da_mensagem ?? '').filter(Boolean)
    const ctx: GuardContext = {
      recentOutbound: texts.slice(0, 12),
      firstOutbound: (first.data ?? []).map((m) => m.texto_da_mensagem ?? '').filter(Boolean),
      totalOutbound: total.count ?? 0,
      gratuitoCount: texts.filter(mentionsGratuito).length,
      rules,
    }

    const result = guardOutput(p.text.split(/\n\n+/), ctx)
    if (result.violations.length === 0) return

    await supabase.from('sdr_logs').insert({
      company_id: p.companyId,
      phone: p.phone ?? null,
      lead_id: p.leadId ?? null,
      event_type: 'output_guard_violation',
      payload: { modo: 'registro', source: p.source, violations: result.violations },
    })
  } catch {
    // auditoria nunca pode derrubar um envio
  }
}
