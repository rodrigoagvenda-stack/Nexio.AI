import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'

export const dynamic = 'force-dynamic'

// Resultado das promoções: sequências do canvas que começam pela etiqueta Promoção.
// Para uma delas, no período: para quantos leads foi disparada, quantos responderam depois do primeiro disparo,
// quantos compraram (viraram Fechado depois do primeiro disparo) e quanto foi vendido.
export async function GET(req: NextRequest) {
  const { context, error: authError } = await requireAuth(req)
  if (authError) return authError

  const url = new URL(req.url)
  const since = url.searchParams.get('since')
  const until = url.searchParams.get('until')
  const wanted = url.searchParams.get('sequence_id')
  const from = since ? new Date(`${since}T00:00:00`) : new Date(Date.now() - 30 * 86_400_000)
  const to = until ? new Date(`${until}T23:59:59.999`) : new Date()

  const supabase = createServiceClient()
  const { data: seqs } = await supabase
    .from('follow_sequences')
    .select('id, nome, display_name')
    .eq('company_id', context.companyId)
    .eq('canvas_config->>eventoEntrada', 'tag_promocao')
    .order('created_at', { ascending: false })

  const sequences = (seqs ?? []).map((s) => ({ id: s.id as string, nome: (s.display_name || s.nome) as string }))
  if (sequences.length === 0) return NextResponse.json({ sequences: [], selected: null })
  const chosen = sequences.find((s) => s.id === wanted) ?? sequences[0]

  const { data: execs } = await supabase
    .from('follow_executions')
    .select('lead_id, disparado_em')
    .eq('company_id', context.companyId)
    .eq('sequence_id', chosen.id)
    .eq('status', 'sent')
    .gte('disparado_em', from.toISOString())
    .lte('disparado_em', to.toISOString())
    .limit(20000)

  const rows = execs ?? []
  const firstByLead = new Map<number, number>()
  for (const r of rows) {
    if (r.lead_id == null) continue
    const t = new Date(r.disparado_em as string).getTime()
    const cur = firstByLead.get(r.lead_id as number)
    if (cur === undefined || t < cur) firstByLead.set(r.lead_id as number, t)
  }
  const leadIds = Array.from(firstByLead.keys())

  let responded = 0
  let bought = 0
  let value = 0
  if (leadIds.length > 0) {
    const [{ data: inbound }, { data: leads }] = await Promise.all([
      supabase.from('mensagens_do_whatsapp').select('id_do_lead, carimbo_de_data_e_hora').eq('company_id', context.companyId).eq('direcao', 'inbound').in('id_do_lead', leadIds).gte('carimbo_de_data_e_hora', from.toISOString()).limit(50000),
      supabase.from('leads').select('id, status, closed_at, project_value').eq('company_id', context.companyId).in('id', leadIds),
    ])
    const replied = new Set<number>()
    for (const m of inbound ?? []) {
      const first = firstByLead.get(m.id_do_lead as number)
      if (first !== undefined && new Date(m.carimbo_de_data_e_hora as string).getTime() > first) replied.add(m.id_do_lead as number)
    }
    responded = replied.size
    for (const l of leads ?? []) {
      const first = firstByLead.get(l.id as number)
      if (l.status === 'Fechado' && l.closed_at && first !== undefined && new Date(l.closed_at as string).getTime() >= first) {
        bought++
        value += Number(l.project_value) || 0
      }
    }
  }

  return NextResponse.json({
    sequences,
    selected: { id: chosen.id, nome: chosen.nome, dispatched: leadIds.length, messages: rows.length, responded, bought, value },
  })
}
