// Funil de aquisição (Inbound/Outbound) : achado a partir do pedido do Bruno
// em 2026-09-04. Origem real de cada conversa é calculada por existência em
// outbound_campaigns (mesma fonte de verdade já usada pro badge de origem no
// Atendimento e pro raciocínio da IA em engine.ts) : leads.origem NÃO é
// confiável pra isso (extração via Orbit grava 'inbound' mesmo pra lead que
// nunca foi contatado, ver lib/sdr/extraction.ts).
//
// "Fechado" usa conversas_do_whatsapp.kanban_stage = 'fechado', mesma fonte
// já usada em /api/reports/cac, pra manter os números consistentes entre
// os dois relatórios.
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'

export async function GET(req: NextRequest) {
  const { context, error: authError } = await requireAuth(req)
  if (authError) return authError

  const url = new URL(req.url)
  const origem = url.searchParams.get('origem') === 'outbound' ? 'outbound' : 'inbound'
  const since = url.searchParams.get('since') ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const until = url.searchParams.get('until') ?? new Date().toISOString()

  const supabase = createServiceClient()
  const companyId = context.companyId

  // Conversas criadas no período
  const { data: conversas } = await supabase
    .from('conversas_do_whatsapp')
    .select('id, numero_de_telefone, id_do_lead, kanban_stage, mensagens_recebidas, criado_em')
    .eq('company_id', companyId)
    .gte('criado_em', since)
    .lte('criado_em', until)

  const allConversas = conversas ?? []

  // Fonte de verdade de origem : existe campanha outbound pra esse telefone?
  const phones = Array.from(new Set(allConversas.map(c => c.numero_de_telefone).filter(Boolean)))
  const { data: outboundRows } = phones.length
    ? await supabase
        .from('outbound_campaigns')
        .select('whatsapp, respondeu')
        .eq('company_id', companyId)
        .in('whatsapp', phones)
    : { data: [] as { whatsapp: string; respondeu: boolean | null }[] }

  const outboundByPhone = new Map<string, boolean>()
  for (const row of outboundRows ?? []) {
    // Se já respondeu em qualquer campanha desse telefone, conta como respondeu
    outboundByPhone.set(row.whatsapp, outboundByPhone.get(row.whatsapp) || !!row.respondeu)
  }

  const filtered = allConversas.filter(c => {
    const isOutbound = outboundByPhone.has(c.numero_de_telefone)
    return origem === 'outbound' ? isOutbound : !isOutbound
  })

  const chegaram = filtered.length
  const responderam = origem === 'outbound'
    ? filtered.filter(c => outboundByPhone.get(c.numero_de_telefone) === true).length
    : filtered.filter(c => (c.mensagens_recebidas ?? 0) >= 2).length

  // Reuniões : leads ligados a essas conversas, agendadas dentro do período
  const leadIds = Array.from(new Set(filtered.map(c => c.id_do_lead).filter((id): id is number => id != null)))
  const { data: leadsRows } = leadIds.length
    ? await supabase
        .from('leads')
        .select('id, call_de_venda, call_agendada_para, call_status')
        .in('id', leadIds)
    : { data: [] as { id: number; call_de_venda: boolean | null; call_agendada_para: string | null; call_status: string | null }[] }

  const agendadas = (leadsRows ?? []).filter(l =>
    l.call_de_venda && l.call_agendada_para && l.call_agendada_para >= since && l.call_agendada_para <= until
  ).length
  const realizadas = (leadsRows ?? []).filter(l =>
    l.call_status === 'realizada' && l.call_agendada_para && l.call_agendada_para >= since && l.call_agendada_para <= until
  ).length

  const vendasFechadas = filtered.filter(c => c.kanban_stage === 'fechado').length

  const base = { chegaram, responderam, agendadas, realizadas, vendas_fechadas: vendasFechadas }

  if (origem !== 'inbound') {
    return NextResponse.json({ origem, since, until, ...base })
  }

  // Camada de custo, só faz sentido pra Inbound (gasto de tráfego pago)
  const { data: insights } = await supabase
    .from('meta_ad_insights')
    .select('spend_cents')
    .eq('company_id', companyId)
    .gte('date', since.slice(0, 10))
    .lte('date', until.slice(0, 10))

  const gastoTrafegoCents = (insights ?? []).reduce((sum, r) => sum + (r.spend_cents ?? 0), 0)

  return NextResponse.json({
    origem, since, until, ...base,
    gasto_trafego_cents: gastoTrafegoCents,
    custo_por_agendada_cents: agendadas > 0 ? Math.round(gastoTrafegoCents / agendadas) : null,
    custo_por_realizada_cents: realizadas > 0 ? Math.round(gastoTrafegoCents / realizadas) : null,
    cac_cents: vendasFechadas > 0 ? Math.round(gastoTrafegoCents / vendasFechadas) : null,
  })
}
