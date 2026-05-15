import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { normalizePhone } from '@/lib/sdr/uazapi'

const TIPO_LABELS: Record<string, string> = {
  follow_geral: 'Follow Geral',
  anti_noshow: 'Anti-Noshow',
  remarketing: 'Remarketing',
  follow_proposta: 'Follow Proposta',
  trial_saas: 'Trial SaaS',
}

const MSG_LABELS: Record<string, string> = {
  text: 'Texto', image: 'Imagem', video: 'Vídeo', audio: 'Áudio',
  ptt: 'PTT', document: 'Documento', menu: 'Menu', carousel: 'Carrossel', location: 'Localização',
}

function periodoMs(p: string) {
  if (p === '7d') return 7 * 86_400_000
  if (p === '90d') return 90 * 86_400_000
  return 30 * 86_400_000
}

function fmtDay(iso: string) {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

function buildDays(since: Date, now: Date) {
  const days: string[] = []
  const cur = new Date(since)
  while (cur <= now) { days.push(fmtDay(cur.toISOString())); cur.setDate(cur.getDate() + 1) }
  return days
}

function calcDelta(cur: number, prev: number) {
  if (prev === 0) return cur > 0 ? 100 : 0
  return Math.round(((cur - prev) / prev) * 100)
}

export async function GET(request: NextRequest) {
  const { context, error: authError } = await requireAuth(request)
  if (authError) return authError

  const periodo = request.nextUrl.searchParams.get('periodo') ?? '30d'
  const companyId = context.companyId
  const svc = createServiceClient()

  const now = new Date()
  const since = new Date(now.getTime() - periodoMs(periodo))
  const prevSince = new Date(since.getTime() - periodoMs(periodo))
  const sinceIso = since.toISOString()
  const prevSinceIso = prevSince.toISOString()

  try {
    // ── Queries paralelas ────────────────────────────────────────────────────
    const [
      { data: execs },
      { data: prevExecs },
      { data: logs },
      { count: prevResponderam },
      { data: trials },
      { data: remarketingLeads },
      { data: sequences },
      { count: totalLeads },
      { count: sequenciasAtivas },
    ] = await Promise.all([
      svc.from('follow_executions')
        .select('id, status, disparado_em, sequence_id, step_id, follow_sequences!inner(tipo, nome)')
        .eq('company_id', companyId).gte('disparado_em', sinceIso),

      svc.from('follow_executions')
        .select('status')
        .eq('company_id', companyId).gte('disparado_em', prevSinceIso).lt('disparado_em', sinceIso),

      svc.from('follow_logs')
        .select('id, tipo, mensagem, enviado_em, respondeu, lead_id, leads!inner(id, contact_name, status, whatsapp)')
        .eq('company_id', companyId).gte('enviado_em', sinceIso)
        .order('enviado_em', { ascending: false }),

      svc.from('follow_logs').select('id', { count: 'exact', head: true })
        .eq('company_id', companyId).eq('respondeu', true)
        .gte('enviado_em', prevSinceIso).lt('enviado_em', sinceIso),

      svc.from('saas_trials')
        .select('id, nome, whatsapp, status, estagio, criado_em, trial_days')
        .eq('company_id', companyId).order('criado_em', { ascending: false }),

      svc.from('leads').select('id, contact_name, whatsapp, status, updated_at')
        .eq('company_id', companyId).eq('status', 'Remarketing')
        .order('updated_at', { ascending: false }),

      svc.from('follow_sequences')
        .select('id, nome, tipo').eq('company_id', companyId),

      svc.from('leads').select('id', { count: 'exact', head: true }).eq('company_id', companyId),

      svc.from('follow_sequences').select('id', { count: 'exact', head: true })
        .eq('company_id', companyId).eq('ativo', true),
    ])

    // ── Trial executions (para aba Execuções) ────────────────────────────────
    const { data: trialExecs } = await svc.from('follow_executions')
      .select('id, disparado_em, trial_id, step_id, follow_steps!inner(mensagem, tipo_mensagem)')
      .eq('company_id', companyId).eq('status', 'sent')
      .not('trial_id', 'is', null)
      .gte('disparado_em', sinceIso)
      .order('disparado_em', { ascending: false }).limit(100)

    const trialIds = [...new Set((trialExecs ?? []).map((e: any) => e.trial_id).filter(Boolean))]
    const { data: trialNames } = trialIds.length > 0
      ? await svc.from('saas_trials').select('id, nome, whatsapp').in('id', trialIds)
      : { data: [] }
    const trialNameMap = Object.fromEntries((trialNames ?? []).map((t: any) => [t.id, t]))

    // ── Aggregations por dia ─────────────────────────────────────────────────
    const allDays = buildDays(since, now)
    const dayMap: Record<string, { enviados: number; falhas: number; responderam: number }> = {}
    for (const d of allDays) dayMap[d] = { enviados: 0, falhas: 0, responderam: 0 }

    let totalEnviados = 0, totalFalhas = 0
    const porTipoMap: Record<string, { tipo: string; label: string; enviados: number; falhas: number; responderam: number }> = {}
    const seqMap: Record<string, { id: string; nome: string; tipo: string; enviados: number; falhas: number; responderam: number }> = {}

    for (const ex of execs ?? []) {
      const seq = (ex as any).follow_sequences
      const tipo = seq?.tipo ?? 'desconhecido'
      const seqId = ex.sequence_id
      if (!porTipoMap[tipo]) porTipoMap[tipo] = { tipo, label: TIPO_LABELS[tipo] ?? tipo, enviados: 0, falhas: 0, responderam: 0 }
      if (seqId && seq && !seqMap[seqId]) seqMap[seqId] = { id: seqId, nome: seq.nome, tipo, enviados: 0, falhas: 0, responderam: 0 }
      const day = fmtDay(ex.disparado_em)
      if (ex.status === 'sent') {
        totalEnviados++; porTipoMap[tipo].enviados++
        if (seqId && seqMap[seqId]) seqMap[seqId].enviados++
        if (dayMap[day]) dayMap[day].enviados++
      } else if (ex.status === 'failed') {
        totalFalhas++; porTipoMap[tipo].falhas++
        if (seqId && seqMap[seqId]) seqMap[seqId].falhas++
        if (dayMap[day]) dayMap[day].falhas++
      }
    }

    let totalResponderam = 0
    const leadLogMap: Record<number, { total: number; responderam: number }> = {}
    for (const l of logs ?? []) {
      const lid = l.lead_id
      if (lid) {
        if (!leadLogMap[lid]) leadLogMap[lid] = { total: 0, responderam: 0 }
        leadLogMap[lid].total++
        if (l.respondeu) leadLogMap[lid].responderam++
      }
      if (!l.respondeu) continue
      totalResponderam++
      const day = fmtDay(l.enviado_em)
      const tipo = l.tipo ?? 'desconhecido'
      if (dayMap[day]) dayMap[day].responderam++
      if (porTipoMap[tipo]) porTipoMap[tipo].responderam++
      const seqEntry = Object.values(seqMap).find((s) => s.tipo === tipo)
      if (seqEntry) seqEntry.responderam++
    }

    // ── Heatmap (disparos com resposta por hora × dia-da-semana) ────────────
    const heatRaw: Record<number, number[]> = {}
    for (let h = 0; h < 24; h++) heatRaw[h] = [0, 0, 0, 0, 0, 0, 0]
    for (const l of logs ?? []) {
      if (!l.respondeu) continue
      const d = new Date(l.enviado_em)
      heatRaw[d.getHours()][d.getDay()]++
    }
    const heatmap = Object.entries(heatRaw).map(([hora, days]) => ({
      hora: parseInt(hora), dom: days[0], seg: days[1], ter: days[2],
      qua: days[3], qui: days[4], sex: days[5], sab: days[6],
    }))

    // ── Cold leads (3+ mensagens, 0 respostas) ────────────────────────────────
    const coldLeadIds = Object.entries(leadLogMap)
      .filter(([_, v]) => v.total >= 3 && v.responderam === 0)
      .map(([id]) => parseInt(id)).slice(0, 30)
    const { data: coldLeadsRaw } = coldLeadIds.length > 0
      ? await svc.from('leads').select('id, contact_name, whatsapp, status').in('id', coldLeadIds)
      : { data: [] }
    const coldLeads = (coldLeadsRaw ?? []).map((l: any) => ({
      id: l.id, nome: l.contact_name ?? '—', whatsapp: l.whatsapp ?? '', status: l.status,
      total_msgs: leadLogMap[l.id]?.total ?? 0,
    }))

    // ── Deltas (vs período anterior) ─────────────────────────────────────────
    const prevEnviados = (prevExecs ?? []).filter((e: any) => e.status === 'sent').length
    const prevTaxa = prevEnviados > 0 ? Math.round(((prevResponderam ?? 0) / prevEnviados) * 100) : 0
    const taxaResposta = totalEnviados > 0 ? Math.round((totalResponderam / totalEnviados) * 100) : 0

    // ── Trial stats ───────────────────────────────────────────────────────────
    const trialsAtivos = (trials ?? []).filter((t: any) => t.status === 'ativo')
    const trialsConvertidos = (trials ?? []).filter((t: any) => t.status === 'convertido')
    const trialsExpirados = (trials ?? []).filter((t: any) => t.status === 'expirado')

    const convDays = trialsConvertidos.map((t: any) =>
      Math.floor((Date.now() - new Date(t.criado_em).getTime()) / 86_400_000)
    )
    const avgDaysToConvert = convDays.length > 0 ? Math.round(convDays.reduce((a, b) => a + b, 0) / convDays.length) : null
    const conversionRate = (trials ?? []).length > 0 ? Math.round((trialsConvertidos.length / (trials ?? []).length) * 100) : 0

    const porEstagioMap: Record<string, number> = {}
    for (const t of trialsAtivos) porEstagioMap[(t as any).estagio ?? 'sem_estagio'] = (porEstagioMap[(t as any).estagio ?? 'sem_estagio'] ?? 0) + 1

    const trialLista = trialsAtivos.map((t: any) => ({
      id: t.id, nome: t.nome, whatsapp: t.whatsapp, status: t.status, estagio: t.estagio ?? null,
      dia_no_trial: Math.floor((Date.now() - new Date(t.criado_em).getTime()) / 86_400_000),
      trial_days: t.trial_days ?? 14, criado_em: t.criado_em,
    }))

    const trialsExpirando = trialLista.filter((t) => (t.trial_days - t.dia_no_trial) <= 7 && t.dia_no_trial < t.trial_days)

    // ── Funnel ────────────────────────────────────────────────────────────────
    const uniqueLeadsEngajados = new Set((logs ?? []).filter((l: any) => l.respondeu).map((l: any) => l.lead_id)).size
    const funil = [
      { etapa: 'Total de Leads', count: totalLeads ?? 0 },
      { etapa: 'Engajados', count: uniqueLeadsEngajados },
      { etapa: 'Em Trial', count: trialsAtivos.length },
      { etapa: 'Convertidos', count: trialsConvertidos.length },
    ].map((e, i, arr) => ({ ...e, pct: arr[0].count > 0 ? Math.round((e.count / arr[0].count) * 100) : 0 }))

    // ── Remarketing stats ─────────────────────────────────────────────────────
    const { count: remarketingResponderam } = await svc.from('follow_logs')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId).eq('tipo', 'remarketing').eq('respondeu', true)
      .gte('enviado_em', sinceIso)

    // ── Anti-noshow e Follow Proposta ─────────────────────────────────────────
    const antiNoshowLogs = (logs ?? []).filter((l: any) => l.tipo === 'anti_noshow')
    const followPropostaLogs = (logs ?? []).filter((l: any) => l.tipo === 'follow_proposta')

    // ── Ranking de sequências ─────────────────────────────────────────────────
    const rankingSequencias = Object.values(seqMap).map((s) => ({
      ...s,
      label: TIPO_LABELS[s.tipo] ?? s.tipo,
      taxa_resposta: s.enviados > 0 ? Math.round((s.responderam / s.enviados) * 100) : 0,
    })).sort((a, b) => b.taxa_resposta - a.taxa_resposta)

    // ── Últimas execuções (follow_logs + trial_execs) ─────────────────────────
    const followExecs = (logs ?? []).slice(0, 80).map((l: any) => ({
      id: l.id, tipo: l.tipo, label: TIPO_LABELS[l.tipo] ?? l.tipo,
      lead_name: l.leads?.contact_name ?? '—', lead_status: l.leads?.status ?? '—',
      lead_whatsapp: l.leads?.whatsapp ?? '',
      mensagem: (l.mensagem ?? '').slice(0, 100),
      enviado_em: l.enviado_em, respondeu: l.respondeu ?? false,
      resposta: null as string | null,
    }))

    const respondedIds = followExecs.filter((e) => e.respondeu && e.lead_name !== '—').map((e: any) => (logs ?? []).find((l: any) => l.id === e.id)?.lead_id).filter(Boolean)
    if (respondedIds.length > 0) {
      const { data: respostas } = await svc.from('mensagens_do_whatsapp')
        .select('id_do_lead, texto_da_mensagem, carimbo_de_data_e_hora')
        .eq('company_id', companyId).eq('direcao', 'inbound')
        .in('id_do_lead', respondedIds).order('carimbo_de_data_e_hora', { ascending: false })
      const rMap: Record<number, string> = {}
      for (const r of respostas ?? []) { if (!rMap[r.id_do_lead]) rMap[r.id_do_lead] = r.texto_da_mensagem ?? '' }
      for (const ex of followExecs) {
        const lid = (logs ?? []).find((l: any) => l.id === ex.id)?.lead_id
        if (lid && rMap[lid]) ex.resposta = rMap[lid]
      }
    }

    const trialExecsFormatted = (trialExecs ?? []).map((e: any) => {
      const trial = trialNameMap[e.trial_id]
      return {
        id: e.id, tipo: 'trial_saas', label: 'Trial SaaS',
        lead_name: trial?.nome ?? '—', lead_status: 'trial_ativo',
        lead_whatsapp: trial?.whatsapp ?? '',
        mensagem: (e.follow_steps?.mensagem ?? '').slice(0, 100),
        enviado_em: e.disparado_em, respondeu: false, resposta: null,
      }
    })

    const ultimasExecucoes = [...followExecs, ...trialExecsFormatted]
      .sort((a, b) => new Date(b.enviado_em).getTime() - new Date(a.enviado_em).getTime())
      .slice(0, 100)

    return NextResponse.json({
      periodo,
      overview: {
        total_enviados: totalEnviados, total_falhas: totalFalhas,
        total_responderam: totalResponderam, taxa_resposta: taxaResposta,
        sequencias_ativas: sequenciasAtivas ?? 0,
        trials_ativos: trialsAtivos.length,
        leads_remarketing: remarketingLeads?.length ?? 0,
        leads_frios: coldLeads.length,
        delta_enviados: calcDelta(totalEnviados, prevEnviados),
        delta_responderam: calcDelta(totalResponderam, prevResponderam ?? 0),
        delta_taxa_resposta: taxaResposta - prevTaxa,
        delta_trials: calcDelta(trialsAtivos.length, 0),
      },
      funil,
      por_dia: allDays.map((d) => ({ data: d, ...dayMap[d] })),
      por_tipo: Object.values(porTipoMap).map((t) => ({
        ...t, taxa_resposta: t.enviados > 0 ? Math.round((t.responderam / t.enviados) * 100) : 0,
      })),
      heatmap,
      ranking_sequencias: rankingSequencias,
      trial: {
        ativos: trialsAtivos.length, expirados: trialsExpirados.length,
        convertidos: trialsConvertidos.length, conversion_rate: conversionRate,
        avg_days_to_convert: avgDaysToConvert,
        por_estagio: Object.entries(porEstagioMap).map(([estagio, count]) => ({ estagio, count })),
        lista: trialLista,
        expirando: trialsExpirando,
      },
      remarketing: {
        total: remarketingLeads?.length ?? 0,
        responderam: remarketingResponderam ?? 0,
        lista: (remarketingLeads ?? []).map((l: any) => ({
          id: l.id, nome: l.contact_name ?? '—', whatsapp: l.whatsapp ?? '',
          status: l.status, updated_at: l.updated_at,
        })),
      },
      anti_noshow: {
        enviados: antiNoshowLogs.length,
        responderam: antiNoshowLogs.filter((l: any) => l.respondeu).length,
        taxa_resposta: antiNoshowLogs.length > 0 ? Math.round((antiNoshowLogs.filter((l: any) => l.respondeu).length / antiNoshowLogs.length) * 100) : 0,
        lista: antiNoshowLogs.slice(0, 30).map((l: any) => ({
          lead_name: l.leads?.contact_name ?? '—', lead_whatsapp: l.leads?.whatsapp ?? '',
          mensagem: (l.mensagem ?? '').slice(0, 80), enviado_em: l.enviado_em, respondeu: l.respondeu ?? false,
        })),
      },
      follow_proposta: {
        enviados: followPropostaLogs.length,
        responderam: followPropostaLogs.filter((l: any) => l.respondeu).length,
        taxa_resposta: followPropostaLogs.length > 0 ? Math.round((followPropostaLogs.filter((l: any) => l.respondeu).length / followPropostaLogs.length) * 100) : 0,
        lista: followPropostaLogs.slice(0, 30).map((l: any) => ({
          lead_name: l.leads?.contact_name ?? '—', lead_whatsapp: l.leads?.whatsapp ?? '',
          mensagem: (l.mensagem ?? '').slice(0, 80), enviado_em: l.enviado_em, respondeu: l.respondeu ?? false,
        })),
      },
      leads_frios: coldLeads,
      ultimas_execucoes: ultimasExecucoes,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
