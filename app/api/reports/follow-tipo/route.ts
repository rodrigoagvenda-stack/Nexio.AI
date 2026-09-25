import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'

export const dynamic = 'force-dynamic'

// Disparos de Anti noshow / Remarketing no período, lidos de follow_executions (o que o canvas grava).
// Por passo: quantos foram enviados. No total: leads alcançados, mensagens e quantos responderam depois do primeiro disparo.
const TIPOS = ['anti_noshow', 'remarketing']

const fmtMin = (m: number) => {
  const a = Math.abs(m)
  const base = a >= 60 && a % 60 === 0 ? `${a / 60}h` : a >= 1440 ? `${Math.round(a / 1440)}d` : `${a}min`
  return `${base} ${m < 0 ? 'antes' : 'após'}`
}

export async function GET(req: NextRequest) {
  const { context, error: authError } = await requireAuth(req)
  if (authError) return authError

  const url = new URL(req.url)
  const tipo = url.searchParams.get('tipo') ?? ''
  if (!TIPOS.includes(tipo)) return NextResponse.json({ error: 'tipo inválido' }, { status: 400 })
  const since = url.searchParams.get('since')
  const until = url.searchParams.get('until')
  const from = since ? new Date(`${since}T00:00:00`) : new Date(Date.now() - 30 * 86_400_000)
  const to = until ? new Date(`${until}T23:59:59.999`) : new Date()

  const supabase = createServiceClient()
  const { data: seqs } = await supabase.from('follow_sequences').select('id').eq('company_id', context.companyId).eq('tipo', tipo)
  const seqIds = (seqs ?? []).map((s) => s.id as string)
  if (seqIds.length === 0) return NextResponse.json({ configured: false, steps: [], leads: 0, messages: 0, responded: 0 })

  const [{ data: steps }, { data: execs }] = await Promise.all([
    supabase.from('follow_steps').select('id, ordem, dia_offset, horario, media_config').in('sequence_id', seqIds).order('ordem'),
    supabase.from('follow_executions').select('lead_id, step_id, disparado_em').eq('company_id', context.companyId).in('sequence_id', seqIds).eq('status', 'sent').gte('disparado_em', from.toISOString()).lte('disparado_em', to.toISOString()).limit(20000),
  ])

  const rows = execs ?? []
  const sentByStep = new Map<string, number>()
  const firstByLead = new Map<number, number>()
  for (const r of rows) {
    sentByStep.set(r.step_id as string, (sentByStep.get(r.step_id as string) ?? 0) + 1)
    if (r.lead_id == null) continue
    const t = new Date(r.disparado_em as string).getTime()
    const cur = firstByLead.get(r.lead_id as number)
    if (cur === undefined || t < cur) firstByLead.set(r.lead_id as number, t)
  }

  const labelOf = (s: { dia_offset: number | null; horario: string | null; media_config: { offset_unit?: string } | null }) => {
    const off = Number(s.dia_offset ?? 0)
    if (tipo === 'anti_noshow') {
      const unit = s.media_config?.offset_unit
      return fmtMin(unit === 'hours' ? off * 60 : unit === 'days' ? off * 1440 : off)
    }
    return off <= 0 ? 'No mesmo dia' : `Dia ${off}`
  }
  const grouped = new Map<string, number>()
  for (const s of steps ?? []) {
    const label = labelOf(s as never)
    grouped.set(label, (grouped.get(label) ?? 0) + (sentByStep.get(s.id as string) ?? 0))
  }

  const leadIds = Array.from(firstByLead.keys())
  let responded = 0
  let returned = 0
  if (leadIds.length > 0) {
    const { data: inbound } = await supabase.from('mensagens_do_whatsapp').select('id_do_lead, carimbo_de_data_e_hora').eq('company_id', context.companyId).eq('direcao', 'inbound').in('id_do_lead', leadIds).gte('carimbo_de_data_e_hora', from.toISOString()).limit(50000)
    const replied = new Set<number>()
    for (const m of inbound ?? []) {
      const first = firstByLead.get(m.id_do_lead as number)
      if (first !== undefined && new Date(m.carimbo_de_data_e_hora as string).getTime() > first) replied.add(m.id_do_lead as number)
    }
    responded = replied.size
    // Voltaram ao funil: respondeu e hoje está numa etapa ativa do CRM
    if (tipo === 'remarketing' && replied.size > 0) {
      const { data: st } = await supabase.from('leads').select('id, status').eq('company_id', context.companyId).in('id', Array.from(replied))
      returned = (st ?? []).filter((l) => ['Em contato', 'Interessado', 'Proposta enviada', 'Fechado'].includes(l.status as string)).length
    }
  }

  let queue = 0
  if (tipo === 'remarketing') {
    const { count } = await supabase.from('leads').select('id', { count: 'exact', head: true }).eq('company_id', context.companyId).eq('status', 'Remarketing')
    queue = count ?? 0
  }

  return NextResponse.json({
    configured: true,
    steps: Array.from(grouped, ([label, sent]) => ({ label, sent })),
    leads: leadIds.length,
    messages: rows.length,
    responded,
    returned,
    queue,
  })
}
