// Ranking de anúncios do Dashboard: gasto (Meta) x conversas e vendas do sistema, por anúncio.
// Junta attribution_events.ad_id com meta_ad_insights.ad_id (o id do anúncio que a Meta manda no referral do
// clique). Eventos antigos gravavam o id do anúncio em campaign_id, então ele entra como segunda tentativa.
// "Qualificado" e "cliente" vêm do status do lead no CRM (conversas.id_do_lead -> leads.status), não da etapa
// do kanban da conversa, que quase ninguém alimenta.
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'

const QUALIFIED_STATUS = ['Interessado', 'Proposta enviada', 'Fechado']

export async function GET(req: NextRequest) {
  const { context, error: authError } = await requireAuth(req)
  if (authError) return authError

  const url = new URL(req.url)
  const sinceParam = url.searchParams.get('since')
  const untilParam = url.searchParams.get('until')
  const days = parseInt(url.searchParams.get('days') ?? '30', 10)
  const since = sinceParam ?? new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const until = untilParam ?? new Date().toISOString().slice(0, 10)

  const supabase = createServiceClient()

  const { data: insights } = await supabase
    .from('meta_ad_insights')
    .select('ad_id, ad_name, campaign_name, spend_cents')
    .eq('company_id', context.companyId)
    .gte('date', since)
    .lte('date', until)
    .limit(20000)

  if (!insights?.length) return NextResponse.json({ ads: [], note: 'Sem dados de gasto sincronizados ainda (aguarde o cron meta-ads-sync ou verifique a conexão da conta de anúncio).' })

  const spendByAd: Record<string, { spend_cents: number; ad_name: string | null; campaign_name: string | null }> = {}
  for (const row of insights) {
    if (!row.ad_id) continue
    if (!spendByAd[row.ad_id]) spendByAd[row.ad_id] = { spend_cents: 0, ad_name: row.ad_name, campaign_name: row.campaign_name }
    spendByAd[row.ad_id].spend_cents += row.spend_cents ?? 0
  }

  const adIds = Object.keys(spendByAd)
  if (!adIds.length) return NextResponse.json({ ads: [] })

  // Conversas de anúncio da empresa no período. attribution_events não tem company_id: passa pela conversa.
  const { data: events } = await supabase
    .from('attribution_events')
    .select('conversation_id, ad_id, campaign_id, conversas_do_whatsapp!inner(company_id, id_do_lead)')
    .eq('source', 'meta_ctwa')
    .eq('conversas_do_whatsapp.company_id', context.companyId)
    .gte('captured_at', `${since}T00:00:00-03:00`)
    .lte('captured_at', `${until}T23:59:59.999-03:00`)
    .limit(20000)

  const known = new Set(adIds)
  const convByAd: Record<string, Map<number, number | null>> = {}
  for (const e of events ?? []) {
    const key = (e.ad_id && known.has(e.ad_id as string) ? e.ad_id : e.campaign_id && known.has(e.campaign_id as string) ? e.campaign_id : null) as string | null
    if (!key) continue
    const conv = (e as unknown as { conversas_do_whatsapp: { id_do_lead: number | null } }).conversas_do_whatsapp
    if (!convByAd[key]) convByAd[key] = new Map()
    convByAd[key].set(e.conversation_id as number, conv?.id_do_lead ?? null)
  }

  const leadIds = Array.from(new Set(Object.values(convByAd).flatMap((m) => Array.from(m.values())).filter((v): v is number => v != null)))
  const statusByLead = new Map<number, string>()
  if (leadIds.length) {
    const { data: leads } = await supabase.from('leads').select('id, status').eq('company_id', context.companyId).in('id', leadIds)
    for (const l of leads ?? []) statusByLead.set(l.id as number, l.status as string)
  }

  const ads = adIds.map((adId) => {
    const spendCents = spendByAd[adId].spend_cents
    const convs = Array.from((convByAd[adId] ?? new Map()).values()) as (number | null)[]
    const statuses = convs.map((leadId) => (leadId != null ? statusByLead.get(leadId) ?? '' : ''))
    const qualified = statuses.filter((s) => QUALIFIED_STATUS.includes(s)).length
    const customers = statuses.filter((s) => s === 'Fechado').length
    return {
      ad_id: adId,
      ad_name: spendByAd[adId].ad_name,
      campaign_name: spendByAd[adId].campaign_name,
      spend_cents: spendCents,
      conversations: convs.length,
      qualified_leads: qualified,
      customers,
      cost_per_qualified_lead_cents: qualified > 0 ? Math.round(spendCents / qualified) : null,
      cost_per_customer_cents: customers > 0 ? Math.round(spendCents / customers) : null,
    }
  })

  return NextResponse.json({ period: { since, until }, ads })
}
