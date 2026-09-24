import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'

export const dynamic = 'force-dynamic'

const VALID_STATUSES = ['agendada', 'confirmada', 'realizada', 'no_show', 'cancelada']

type Kind = 'follow' | 'noshow' | 'remarketing'
const KIND: Record<string, Kind> = { follow_geral: 'follow', follow_proposta: 'follow', trial_saas: 'follow', anti_noshow: 'noshow', remarketing: 'remarketing' }

// Calendário de Automações: calls marcadas e disparos já enviados numa janela de datas (a semana exibida),
// mais o último disparo da empresa e quantas calls passadas ainda estão como "agendada".
export async function GET(req: NextRequest) {
  const { context, error: authError } = await requireAuth(req)
  if (authError) return authError

  const fromRaw = req.nextUrl.searchParams.get('from')
  const toRaw = req.nextUrl.searchParams.get('to')
  const from = fromRaw ? new Date(fromRaw) : null
  const to = toRaw ? new Date(toRaw) : null
  if (!from || !to || Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from || to.getTime() - from.getTime() > 45 * 86_400_000) {
    return NextResponse.json({ error: 'Período inválido' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const companyId = context.companyId
  const nowIso = new Date().toISOString()

  const [callsRes, execRes, seqRes, lastExecRes, pastPendingRes] = await Promise.all([
    supabase.from('leads').select('id, contact_name, company_name, call_agendada_para, call_status, meet_url')
      .eq('company_id', companyId).not('call_agendada_para', 'is', null)
      .gte('call_agendada_para', from.toISOString()).lt('call_agendada_para', to.toISOString())
      .order('call_agendada_para', { ascending: true }).limit(500),
    supabase.from('follow_executions').select('id, disparado_em, lead_id, sequence_id, step_id')
      .eq('company_id', companyId).eq('status', 'sent')
      .gte('disparado_em', from.toISOString()).lt('disparado_em', to.toISOString())
      .order('disparado_em', { ascending: false }).limit(3000),
    supabase.from('follow_sequences').select('id, nome, display_name, tipo').eq('company_id', companyId),
    supabase.from('follow_executions').select('disparado_em').eq('company_id', companyId).eq('status', 'sent')
      .order('disparado_em', { ascending: false }).limit(1),
    supabase.from('leads').select('id, call_agendada_para').eq('company_id', companyId)
      .eq('call_status', 'agendada').lt('call_agendada_para', nowIso).order('call_agendada_para', { ascending: false }).limit(200),
  ])

  const seqMap = new Map((seqRes.data ?? []).map((s) => [s.id, s]))
  const executions = execRes.data ?? []

  // Só carrega nome do lead e trecho da mensagem do que realmente vai aparecer na lista
  const leadIds = Array.from(new Set(executions.map((e) => e.lead_id).filter((id): id is number => id != null)))
  const stepIds = Array.from(new Set(executions.map((e) => e.step_id).filter((id): id is string => !!id)))
  const [leadsRes, stepsRes] = await Promise.all([
    leadIds.length ? supabase.from('leads').select('id, contact_name, company_name').in('id', leadIds) : Promise.resolve({ data: [] as { id: number; contact_name: string | null; company_name: string | null }[] }),
    stepIds.length ? supabase.from('follow_steps').select('id, mensagem, tipo_mensagem').in('id', stepIds) : Promise.resolve({ data: [] as { id: string; mensagem: string | null; tipo_mensagem: string | null }[] }),
  ])
  const leadName = new Map((leadsRes.data ?? []).map((l) => [l.id, l.contact_name || l.company_name || 'Lead']))
  const stepInfo = new Map((stepsRes.data ?? []).map((s) => [s.id, s]))

  const disparos = executions.map((e) => {
    const seq = seqMap.get(e.sequence_id)
    const step = e.step_id ? stepInfo.get(e.step_id) : undefined
    const kind: Kind = KIND[seq?.tipo ?? ''] ?? 'follow'
    const preview = step?.mensagem?.trim() || (step?.tipo_mensagem && step.tipo_mensagem !== 'text' ? `Mensagem de ${step.tipo_mensagem === 'audio' ? 'áudio' : step.tipo_mensagem === 'image' ? 'imagem' : step.tipo_mensagem === 'video' ? 'vídeo' : 'mídia'}` : '')
    return {
      id: e.id as string,
      at: e.disparado_em as string,
      kind,
      sequence: seq?.display_name || seq?.nome || 'Automação',
      lead: leadName.get(e.lead_id as number) ?? 'Lead',
      preview,
    }
  })

  const calls = (callsRes.data ?? []).map((c) => ({
    id: c.id as number,
    at: c.call_agendada_para as string,
    lead: c.contact_name || c.company_name || 'Lead',
    status: (c.call_status as string | null) ?? 'agendada',
    meetUrl: (c.meet_url as string | null) ?? null,
  }))

  const pastPending = pastPendingRes.data ?? []
  return NextResponse.json({
    calls,
    disparos,
    lastDisparoAt: lastExecRes.data?.[0]?.disparado_em ?? null,
    pastPendingAt: pastPending.map((c) => c.call_agendada_para as string),
  })
}

// Marca o resultado de uma call (Agendada, Realizada, No-show...) para o funil e o dashboard contarem certo.
export async function PATCH(req: NextRequest) {
  const { context, error: authError } = await requireAuth(req)
  if (authError) return authError

  const { leadId, call_status } = await req.json().catch(() => ({}))
  if (!leadId || !VALID_STATUSES.includes(call_status)) {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { error } = await supabase.from('leads').update({ call_status }).eq('id', leadId).eq('company_id', context.companyId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
