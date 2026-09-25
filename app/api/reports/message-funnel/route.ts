// Card "Conversas do anúncio" do Dashboard.
// Da Meta (meta_ad_insights, sincronizado por lib/sdr/meta-ads-sync.ts): gasto, cliques no link, conversas iniciadas
// e primeira resposta. Do sistema: profundidade da conversa (quantas o lead respondeu com 2, 3, 5 e 10+ mensagens),
// porque os números de profundidade da Meta misturam conversas com volume de mensagens (ver lib/meta/message-funnel.ts).
//
// Campanhas que não levam ao WhatsApp (ex.: visitas ao perfil) ficam fora das contas de custo por clique e por
// conversa, senão o gasto delas infla o custo por conversa. O gasto total continua somando tudo.
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { aggregateMessageFunnel, getUnmatchedActionTypes, type MetaAction } from '@/lib/meta/message-funnel'

const sumAction = (raw: unknown, match: (t: string) => boolean) =>
  Array.isArray(raw) ? (raw as MetaAction[]).filter((a) => a.action_type && match(a.action_type)).reduce((s, a) => s + (Number(a.value) || 0), 0) : 0

export async function GET(req: NextRequest) {
  const { context, error: authError } = await requireAuth(req)
  if (authError) return authError

  const url = new URL(req.url)
  const sinceParam = url.searchParams.get('since')
  const untilParam = url.searchParams.get('until')
  const days = parseInt(url.searchParams.get('days') ?? '7', 10)
  const since = sinceParam ?? new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const until = untilParam ?? new Date().toISOString().slice(0, 10)

  const supabase = createServiceClient()

  const [{ data: insights }, { data: history }, { data: depthRows }] = await Promise.all([
    supabase.from('meta_ad_insights').select('campaign_id, raw, spend_cents, clicks').eq('company_id', context.companyId).gte('date', since).lte('date', until).limit(20000),
    // Uma campanha é "de conversa" se em algum dia já iniciou conversa (mesmo que no período filtrado tenha zerado).
    supabase.from('meta_ad_insights').select('campaign_id, raw').eq('company_id', context.companyId).limit(20000),
    supabase.rpc('ad_conversation_depth', { p_company: context.companyId, p_from: `${since}T00:00:00-03:00`, p_to: `${until}T23:59:59.999-03:00` }),
  ])

  const depth = (depthRows as { total: number; lead_2: number; lead_3: number; lead_5: number; lead_10: number }[] | null)?.[0] ?? null

  if (!insights?.length) {
    return NextResponse.json({
      stages: [],
      depth,
      note: 'Sem dados sincronizados ainda (aguarde o cron meta-ads-sync ou verifique a conexão da conta de anúncio).',
    })
  }

  const conversationCampaigns = new Set<string>()
  for (const r of history ?? []) {
    if (r.campaign_id && sumAction(r.raw, (t) => t.includes('messaging_conversation_started')) > 0) conversationCampaigns.add(r.campaign_id as string)
  }

  const rawRows = insights.map((r) => r.raw)
  const stages = aggregateMessageFunnel(rawRows)
  let totalSpend = 0
  let convSpend = 0
  let convLinkClicks = 0
  for (const r of insights) {
    const spend = r.spend_cents ?? 0
    totalSpend += spend
    if (r.campaign_id && conversationCampaigns.has(r.campaign_id as string)) {
      convSpend += spend
      convLinkClicks += sumAction(r.raw, (t) => t === 'link_click')
    }
  }

  const stagesWithCost = stages.map((s) => ({
    ...s,
    cost_per_unit_cents: s.count > 0 ? Math.round(convSpend / s.count) : null,
  }))

  return NextResponse.json({
    since,
    until,
    stages: stagesWithCost,
    total_spend_cents: totalSpend,
    conversation_spend_cents: convSpend,
    other_spend_cents: totalSpend - convSpend,
    link_clicks: convLinkClicks,
    depth,
    unmatched_action_types: getUnmatchedActionTypes(rawRows),
  })
}
