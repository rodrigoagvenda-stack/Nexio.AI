// Card de funil do Dashboard (Paper: Funil de vendas em "Conversão" e "Onde estão agora", e a aba Anti noshow).
// Coorte inbound: leads criados no período que não vieram de campanha outbound (mesma regra de /api/reports/funil).
// Etapas de Conversão: inbound, responderam (2+ mensagens do lead), reunião agendada, realizada e fechamento.
// "Fechamento" usa o status do lead no CRM, não a etapa do kanban da conversa.
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'

export const dynamic = 'force-dynamic'

const digits = (s: string | null | undefined) => String(s ?? '').replace(/\D/g, '')

async function inChunks<T, R>(items: T[], size: number, fn: (chunk: T[]) => Promise<R[]>): Promise<R[]> {
  const out: R[] = []
  for (let i = 0; i < items.length; i += size) out.push(...(await fn(items.slice(i, i + size))))
  return out
}

const STAGES = ['Triagem', 'Lead novo', 'Em contato', 'Interessado', 'Proposta enviada', 'Remarketing', 'Fechado'] as const

export async function GET(req: NextRequest) {
  const { context, error: authError } = await requireAuth(req)
  if (authError) return authError

  const url = new URL(req.url)
  const since = url.searchParams.get('since') ?? new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10)
  const until = url.searchParams.get('until') ?? new Date().toISOString().slice(0, 10)
  const from = `${since}T00:00:00-03:00`
  const to = `${until}T23:59:59.999-03:00`
  const nowIso = new Date().toISOString()

  const supabase = createServiceClient()
  const companyId = context.companyId

  const [{ data: outbound }, { data: leadsRaw }] = await Promise.all([
    supabase.from('outbound_campaigns').select('whatsapp').eq('company_id', companyId).limit(50000),
    supabase
      .from('leads')
      .select('id, status, whatsapp, call_agendada_para, call_status, created_at')
      .eq('company_id', companyId)
      .gte('created_at', from)
      .lte('created_at', to)
      .limit(20000),
  ])

  const outboundPhones = new Set((outbound ?? []).map((o) => digits(o.whatsapp as string)))
  const cohort = (leadsRaw ?? []).filter((l) => !outboundPhones.has(digits(l.whatsapp as string)))
  const leadIds = cohort.map((l) => l.id as number)

  const convs = await inChunks(leadIds, 300, async (chunk) => {
    const { data } = await supabase.from('conversas_do_whatsapp').select('id_do_lead, mensagens_recebidas').eq('company_id', companyId).in('id_do_lead', chunk)
    return (data ?? []) as { id_do_lead: number; mensagens_recebidas: number | null }[]
  })
  const receivedByLead = new Map<number, number>()
  for (const c of convs) receivedByLead.set(c.id_do_lead, Math.max(receivedByLead.get(c.id_do_lead) ?? 0, c.mensagens_recebidas ?? 0))

  const total = cohort.length
  const responderam = cohort.filter((l) => (receivedByLead.get(l.id as number) ?? 0) >= 2).length
  const agendadas = cohort.filter((l) => l.call_agendada_para && l.call_status !== 'cancelada')
  const realizadas = agendadas.filter((l) => l.call_status === 'realizada').length
  const noShowCoorte = agendadas.filter((l) => l.call_status === 'no_show').length
  const fechados = cohort.filter((l) => l.status === 'Fechado').length

  const byStatus: Record<string, number> = {}
  for (const l of cohort) byStatus[l.status as string] = (byStatus[l.status as string] ?? 0) + 1

  // Anti noshow: reuniões marcadas para dentro do período (de qualquer lead da empresa), não só da coorte
  const { data: meetingsRaw } = await supabase
    .from('leads')
    .select('id, call_agendada_para, call_status')
    .eq('company_id', companyId)
    .not('call_agendada_para', 'is', null)
    .gte('call_agendada_para', from)
    .lte('call_agendada_para', to)
    .limit(20000)
  const meetings = (meetingsRaw ?? []).filter((m) => m.call_status !== 'cancelada')
  const mPast = meetings.filter((m) => (m.call_agendada_para as string) < nowIso)
  const mDone = meetings.filter((m) => m.call_status === 'realizada').length
  const mNoShow = meetings.filter((m) => m.call_status === 'no_show').length
  const mSemResultado = mPast.filter((m) => m.call_status === 'agendada').length

  return NextResponse.json({
    conversao: {
      inbound: total,
      responderam,
      agendadas: agendadas.length,
      realizadas,
      fechados,
      nao_responderam: total - responderam,
      no_show: noShowCoorte,
      sem_resultado: agendadas.filter((l) => (l.call_agendada_para as string) < nowIso && l.call_status === 'agendada').length,
    },
    agora: {
      total,
      etapas: STAGES.map((s) => ({ label: s, count: byStatus[s] ?? 0 })),
      perdidos: byStatus['Perdido'] ?? 0,
    },
    noshow: {
      agendadas: meetings.length,
      passadas: mPast.length,
      compareceram: mDone,
      no_show: mNoShow,
      sem_resultado: mSemResultado,
      futuras: meetings.length - mPast.length,
    },
  })
}
