// Peça B-3 do plano "máquina de vendas completa": CAC por anúncio.
// channel_conversion_report (materialized view existente) agrupa só por
// canal/dia, não por anúncio -- não serve pronto pra isso. Calculado aqui,
// direto na API, em vez de outra view nova (menos risco, sem agenda de
// refresh pra gerenciar).
//
// Nota de implementação: attribution_events tem colunas ad_id/ad_name, mas
// lib/sdr/inbound.ts nunca escreve nelas -- o id do anúncio (referral.source_id
// da Meta) é gravado hoje em campaign_id. Junta por campaign_id aqui pra
// refletir o dado real, não o nome da coluna que "deveria" ser.
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'

const QUALIFIED_STAGES = ['qualificacao', 'fila', 'em_atendimento', 'negociacao', 'fechado']

export async function GET(req: NextRequest) {
  const { context, error: authError } = await requireAuth(req)
  if (authError) return authError

  const url = new URL(req.url)
  const days = parseInt(url.searchParams.get('days') ?? '30', 10)
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const supabase = createServiceClient()

  const { data: insights } = await supabase
    .from('meta_ad_insights')
    .select('ad_id, ad_name, campaign_name, spend_cents')
    .eq('company_id', context.companyId)
    .gte('date', since)

  if (!insights?.length) return NextResponse.json({ ads: [], note: 'Sem dados de gasto sincronizados ainda (aguarde o cron meta-ads-sync ou verifique a conexão da conta de anúncio).' })

  const spendByAd: Record<string, { spend_cents: number; ad_name: string | null; campaign_name: string | null }> = {}
  for (const row of insights) {
    if (!row.ad_id) continue
    if (!spendByAd[row.ad_id]) spendByAd[row.ad_id] = { spend_cents: 0, ad_name: row.ad_name, campaign_name: row.campaign_name }
    spendByAd[row.ad_id].spend_cents += row.spend_cents ?? 0
  }

  const adIds = Object.keys(spendByAd)
  if (!adIds.length) return NextResponse.json({ ads: [] })

  // Ver nota de implementação no topo do arquivo: campaign_id aqui é, na
  // prática, o ad_id vindo do referral da Meta.
  const { data: events } = await supabase
    .from('attribution_events')
    .select('conversation_id, campaign_id')
    .in('campaign_id', adIds)

  const convIdsByAd: Record<string, number[]> = {}
  for (const e of events ?? []) {
    if (!e.campaign_id) continue
    if (!convIdsByAd[e.campaign_id]) convIdsByAd[e.campaign_id] = []
    convIdsByAd[e.campaign_id].push(e.conversation_id)
  }

  const allConvIds = Array.from(new Set((events ?? []).map(e => e.conversation_id)))
  const { data: convs } = allConvIds.length
    ? await supabase
        .from('conversas_do_whatsapp')
        .select('id, kanban_stage')
        .eq('company_id', context.companyId)
        .in('id', allConvIds)
    : { data: [] as { id: number; kanban_stage: string | null }[] }

  const stageById: Record<number, string | null> = {}
  for (const c of convs ?? []) stageById[c.id] = c.kanban_stage

  const ads = adIds.map(adId => {
    const spendCents = spendByAd[adId].spend_cents
    const convIds = convIdsByAd[adId] ?? []
    const qualified = convIds.filter(id => QUALIFIED_STAGES.includes(stageById[id] ?? '')).length
    const customers = convIds.filter(id => stageById[id] === 'fechado').length

    return {
      ad_id: adId,
      ad_name: spendByAd[adId].ad_name,
      campaign_name: spendByAd[adId].campaign_name,
      spend_cents: spendCents,
      conversations: convIds.length,
      qualified_leads: qualified,
      customers,
      cost_per_qualified_lead_cents: qualified > 0 ? Math.round(spendCents / qualified) : null,
      cost_per_customer_cents: customers > 0 ? Math.round(spendCents / customers) : null,
    }
  })

  return NextResponse.json({ period_days: days, ads })
}
