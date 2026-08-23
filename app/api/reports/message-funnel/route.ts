// Funil de mensagens (profundidade de conversa) da campanha de anúncios,
// direto da Meta Insights API -- reaproveita o mesmo dado que
// lib/sdr/meta-ads-sync.ts já sincroniza em meta_ad_insights.raw, só nunca
// tinha sido parseado. Ver lib/meta/message-funnel.ts pra nota sobre nomes
// de campo não conferidos contra resposta real ainda.
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { aggregateMessageFunnel, getUnmatchedActionTypes } from '@/lib/meta/message-funnel'

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

  const { data: insights } = await supabase
    .from('meta_ad_insights')
    .select('raw, spend_cents')
    .eq('company_id', context.companyId)
    .gte('date', since)
    .lte('date', until)

  if (!insights?.length) {
    return NextResponse.json({
      stages: [],
      note: 'Sem dados sincronizados ainda (aguarde o cron meta-ads-sync ou verifique a conexão da conta de anúncio).',
    })
  }

  const rawRows = insights.map(r => r.raw)
  const stages = aggregateMessageFunnel(rawRows)
  const totalSpendCents = insights.reduce((sum, r) => sum + (r.spend_cents ?? 0), 0)
  const unmatched = getUnmatchedActionTypes(rawRows)

  const stagesWithCost = stages.map(s => ({
    ...s,
    cost_per_unit_cents: s.count > 0 ? Math.round(totalSpendCents / s.count) : null,
  }))

  return NextResponse.json({
    since,
    until,
    stages: stagesWithCost,
    total_spend_cents: totalSpendCents,
    // Ajuda a conferir se os nomes de campo em lib/meta/message-funnel.ts
    // realmente batem com o que a Meta devolve pra essa conta -- se aparecer
    // algo aqui parecido com profundidade/mensagem que devia ter sido
    // capturado, o matcher precisa de ajuste.
    unmatched_action_types: unmatched,
  })
}
