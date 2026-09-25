import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'

export const dynamic = 'force-dynamic'

// Resumo do SDR: números dos últimos 30 dias e o que pede atenção. Tudo calculado dos dados reais da empresa.
export async function GET(request: NextRequest) {
  const { context, error: authError } = await requireAuth(request)
  if (authError) return authError

  const supabase = createServiceClient()
  const companyId = context.companyId
  const day = 86_400_000
  const since30 = new Date(Date.now() - 30 * day).toISOString()
  const since7 = new Date(Date.now() - 7 * day).toISOString()

  const count = { count: 'exact' as const, head: true }
  const msgs = () => supabase.from('mensagens_do_whatsapp').select('id', count).eq('company_id', companyId).gte('carimbo_de_data_e_hora', since30)
  const REVIEW_EVENTS = ['funnel_humanizado', 'funnel_conversa', 'funnel_reaction']

  const [cfgRes, fnRes, lastMsgRes, agentRes, inboundRes, teamRes, convTotalRes, convActiveRes, handoffRes, blockedRes, blockedLastRes, convAllRes, convCtwaRes, convGclidRes] = await Promise.all([
    supabase.from('sdr_configs').select('flow_id').eq('company_id', companyId).limit(1).maybeSingle(),
    supabase.from('sdr_funnel_configs').select('config').eq('company_id', companyId).maybeSingle(),
    supabase.from('mensagens_do_whatsapp').select('carimbo_de_data_e_hora').eq('company_id', companyId).order('carimbo_de_data_e_hora', { ascending: false }).limit(1).maybeSingle(),
    msgs().eq('direcao', 'outbound').eq('sender_type', 'ai'),
    msgs().eq('direcao', 'inbound'),
    msgs().eq('direcao', 'outbound').neq('sender_type', 'ai'),
    supabase.from('conversas_do_whatsapp').select('id', count).eq('company_id', companyId).gte('hora_da_ultima_mensagem', since30),
    supabase.from('conversas_do_whatsapp').select('id', count).eq('company_id', companyId).gte('hora_da_ultima_mensagem', since30).eq('agente_pausado', false),
    supabase.from('sdr_logs').select('id', count).eq('company_id', companyId).eq('event_type', 'funnel_handoff').gte('created_at', since7),
    supabase.from('sdr_logs').select('id', count).eq('company_id', companyId).in('event_type', REVIEW_EVENTS).eq('payload->>aprovada', 'false').gte('created_at', since7),
    supabase.from('sdr_logs').select('created_at').eq('company_id', companyId).in('event_type', REVIEW_EVENTS).eq('payload->>aprovada', 'false').gte('created_at', since7).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('conversas_do_whatsapp').select('id', count).eq('company_id', companyId),
    supabase.from('conversas_do_whatsapp').select('id', count).eq('company_id', companyId).not('ctwa_clid', 'is', null),
    supabase.from('conversas_do_whatsapp').select('id', count).eq('company_id', companyId).not('gclid', 'is', null),
  ])

  const flowId = cfgRes.data?.flow_id as string | null | undefined
  let docs = 0
  if (flowId) {
    const { count: c } = await supabase.from('documents').select('id', count).eq('company_id', companyId).contains('metadata', { flow_id: flowId, doc_type: 'conhecimento' })
    docs = c ?? 0
  }

  const fn = (fnRes.data?.config ?? null) as { steps?: unknown[]; objections?: Record<string, unknown> } | null

  return NextResponse.json({
    lastMessageAt: lastMsgRes.data?.carimbo_de_data_e_hora ?? null,
    agentMessages30: agentRes.count ?? 0,
    inbound30: inboundRes.count ?? 0,
    team30: teamRes.count ?? 0,
    conversations30: convTotalRes.count ?? 0,
    conversationsAgentOn30: convActiveRes.count ?? 0,
    handoffs7: handoffRes.count ?? 0,
    blocked7: blockedRes.count ?? 0,
    blockedLastAt: blockedLastRes.data?.created_at ?? null,
    knowledgeChunks: docs,
    conversationsAll: convAllRes.count ?? 0,
    conversationsCtwa: convCtwaRes.count ?? 0,
    conversationsGclid: convGclidRes.count ?? 0,
    funnel: fn ? { steps: fn.steps?.length ?? 0, objections: fn.objections ? Object.keys(fn.objections).length : 0 } : null,
  })
}
