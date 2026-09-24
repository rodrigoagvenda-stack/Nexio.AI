import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'

// Visão geral de Automações: quantas sequências estão ligadas, o que foi enviado nos últimos 30 dias,
// o que pede atenção e o estado do SDR e do Outbound. Tudo calculado a partir dos dados reais da empresa.
export async function GET(req: NextRequest) {
  const { context, error: authError } = await requireAuth(req)
  if (authError) return authError

  const supabase = createServiceClient()
  const companyId = context.companyId
  const now = Date.now()
  const since30 = new Date(now - 30 * 86_400_000).toISOString()
  const tz = 'America/Sao_Paulo'
  const dayKey = (iso: string | number) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: tz, day: '2-digit', month: '2-digit' })

  const [seqRes, execRes, companyRes, outboundRes] = await Promise.all([
    supabase.from('follow_sequences').select('id, nome, display_name, ativo').eq('company_id', companyId),
    supabase.from('follow_executions').select('id, lead_id, sequence_id, disparado_em').eq('company_id', companyId).eq('status', 'sent').gte('disparado_em', since30).order('disparado_em', { ascending: false }).limit(3000),
    supabase.from('companies').select('agente_ativo').eq('id', companyId).maybeSingle(),
    supabase.from('outbound_campaigns').select('id, tentativas, max_tentativas, proximo_contato_em, respondeu, converteu, numero_bloqueado').eq('company_id', companyId),
  ])

  const sequences = seqRes.data ?? []
  const executions = execRes.data ?? []
  const seqName = new Map(sequences.map((s) => [s.id, s.display_name || s.nome]))

  // Atividade recente: últimos disparos com o nome do lead
  const latest = executions.slice(0, 7)
  const leadIds = Array.from(new Set(latest.map((e) => e.lead_id).filter((id): id is number => id != null)))
  const { data: leadRows } = leadIds.length
    ? await supabase.from('leads').select('id, company_name, contact_name').in('id', leadIds)
    : { data: [] as { id: number; company_name: string | null; contact_name: string | null }[] }
  const leadName = new Map((leadRows ?? []).map((l) => [l.id, l.contact_name || l.company_name || 'Lead']))
  const recent = latest.map((e) => ({
    at: e.disparado_em,
    day: dayKey(e.disparado_em),
    time: new Date(e.disparado_em).toLocaleTimeString('pt-BR', { timeZone: tz, hour: '2-digit', minute: '2-digit' }),
    lead: leadName.get(e.lead_id as number) ?? 'Lead',
    automation: seqName.get(e.sequence_id) ?? 'Automação',
  }))

  const today = dayKey(now)
  const yesterday = dayKey(now - 86_400_000)
  const sentToday = executions.filter((e) => dayKey(e.disparado_em) === today).length
  const sentYesterday = executions.filter((e) => dayKey(e.disparado_em) === yesterday).length

  // Sequências desligadas que já enviaram mensagens (vale olhar se foi de propósito)
  const inactive = sequences.filter((s) => s.ativo === false)
  const attention: { title: string; text: string }[] = []
  if (inactive.length) {
    const { data: sentRows } = await supabase.from('follow_executions').select('sequence_id').eq('company_id', companyId).eq('status', 'sent').in('sequence_id', inactive.map((s) => s.id)).limit(5000)
    const perSeq = new Map<string, number>()
    ;(sentRows ?? []).forEach((r) => perSeq.set(r.sequence_id, (perSeq.get(r.sequence_id) ?? 0) + 1))
    inactive.forEach((s) => {
      const n = perSeq.get(s.id) ?? 0
      if (n > 0) attention.push({ title: `${s.display_name || s.nome} está desligada`, text: `Enviou ${n} ${n === 1 ? 'mensagem' : 'mensagens'} antes de ser desligada.` })
    })
  }

  // Outbound parado na primeira tentativa: o próximo contato já venceu e ninguém respondeu
  const campaigns = outboundRes.data ?? []
  const stuck = campaigns.filter((c) => (c.tentativas ?? 0) <= 1 && !c.respondeu && !c.converteu && !c.numero_bloqueado
    && c.proximo_contato_em && new Date(c.proximo_contato_em).getTime() < now && (c.tentativas ?? 0) < (c.max_tentativas ?? 99))
  if (stuck.length > 0) {
    const times = stuck.map((c) => new Date(c.proximo_contato_em as string).getTime())
    const from = dayKey(Math.min(...times)); const to = dayKey(Math.max(...times))
    attention.unshift({
      title: 'Outbound parado na 1ª tentativa',
      text: `${stuck.length} de ${campaigns.length} só receberam a primeira mensagem. O próximo contato ${stuck.length === 1 ? 'venceu em' : 'de todos venceu entre'} ${from === to ? from : `${from} e ${to}`}.`,
    })
  }

  return NextResponse.json({
    sequences: { total: sequences.length, active: sequences.filter((s) => s.ativo !== false).length },
    messages30: executions.length,
    lastSentAt: executions[0]?.disparado_em ?? null,
    sentToday, sentYesterday, today, yesterday,
    recent,
    attention,
    sdrActive: !!companyRes.data?.agente_ativo,
    outboundCampaigns: campaigns.length,
  })
}
