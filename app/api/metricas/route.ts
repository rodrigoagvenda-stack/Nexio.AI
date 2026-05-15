import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'

const TIPO_LABELS: Record<string, string> = {
  follow_geral: 'Follow Geral',
  anti_noshow: 'Anti-Noshow',
  remarketing: 'Remarketing',
  follow_proposta: 'Follow Proposta',
  trial_saas: 'Trial SaaS',
}

function periodoMs(periodo: string): number {
  if (periodo === '7d') return 7 * 86_400_000
  if (periodo === '90d') return 90 * 86_400_000
  return 30 * 86_400_000
}

function fmtDay(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

function buildDayRange(since: Date, now: Date): string[] {
  const days: string[] = []
  const cur = new Date(since)
  while (cur <= now) {
    days.push(fmtDay(cur.toISOString()))
    cur.setDate(cur.getDate() + 1)
  }
  return days
}

export async function GET(request: NextRequest) {
  const { context, error: authError } = await requireAuth(request)
  if (authError) return authError

  const periodo = request.nextUrl.searchParams.get('periodo') ?? '30d'
  const companyId = context.companyId
  const service = createServiceClient()

  const now = new Date()
  const since = new Date(now.getTime() - periodoMs(periodo))
  const sinceIso = since.toISOString()

  try {
    // ── Follow executions (follow_geral, anti_noshow, remarketing, follow_proposta, trial_saas)
    const { data: executions } = await service
      .from('follow_executions')
      .select('id, status, disparado_em, sequence_id, follow_sequences!inner(tipo)')
      .eq('company_id', companyId)
      .gte('disparado_em', sinceIso)

    // ── Follow logs (respondeu)
    const { data: logs } = await service
      .from('follow_logs')
      .select('id, tipo, mensagem, enviado_em, respondeu, lead_id, leads!inner(id, contact_name, status, whatsapp)')
      .eq('company_id', companyId)
      .gte('enviado_em', sinceIso)
      .order('enviado_em', { ascending: false })

    // ── Últimos logs (para tabela de execuções)
    const recentLogs = (logs ?? []).slice(0, 50)
    const respondedLeadIds = recentLogs
      .filter((l: any) => l.respondeu && l.lead_id)
      .map((l: any) => l.lead_id)

    const respostasMap: Record<number, string> = {}
    if (respondedLeadIds.length > 0) {
      const { data: respostas } = await service
        .from('mensagens_do_whatsapp')
        .select('id_do_lead, texto_da_mensagem, carimbo_de_data_e_hora')
        .eq('company_id', companyId)
        .eq('direcao', 'inbound')
        .in('id_do_lead', respondedLeadIds)
        .order('carimbo_de_data_e_hora', { ascending: false })
      for (const r of respostas ?? []) {
        if (!respostasMap[r.id_do_lead]) respostasMap[r.id_do_lead] = r.texto_da_mensagem ?? ''
      }
    }

    // ── Aggregations por dia
    const allDays = buildDayRange(since, now)
    const dayMap: Record<string, { enviados: number; falhas: number; responderam: number }> = {}
    for (const d of allDays) dayMap[d] = { enviados: 0, falhas: 0, responderam: 0 }

    let totalEnviados = 0
    let totalFalhas = 0
    const porTipoMap: Record<string, { tipo: string; label: string; enviados: number; falhas: number; responderam: number }> = {}

    for (const ex of executions ?? []) {
      const tipo = (ex as any).follow_sequences?.tipo ?? 'desconhecido'
      if (!porTipoMap[tipo]) porTipoMap[tipo] = { tipo, label: TIPO_LABELS[tipo] ?? tipo, enviados: 0, falhas: 0, responderam: 0 }
      const day = fmtDay(ex.disparado_em)
      if (ex.status === 'sent') {
        totalEnviados++
        porTipoMap[tipo].enviados++
        if (dayMap[day]) dayMap[day].enviados++
      } else if (ex.status === 'failed') {
        totalFalhas++
        porTipoMap[tipo].falhas++
        if (dayMap[day]) dayMap[day].falhas++
      }
    }

    let totalResponderam = 0
    for (const l of logs ?? []) {
      if (!l.respondeu) continue
      totalResponderam++
      const day = fmtDay(l.enviado_em)
      if (dayMap[day]) dayMap[day].responderam++
      const tipo = l.tipo ?? 'desconhecido'
      if (porTipoMap[tipo]) porTipoMap[tipo].responderam++
    }

    const porDia = allDays.map((d) => ({ data: d, ...dayMap[d] }))

    const porTipo = Object.values(porTipoMap).map((t) => ({
      ...t,
      taxa_resposta: t.enviados > 0 ? Math.round((t.responderam / t.enviados) * 100) : 0,
    }))

    // ── Sequências ativas
    const { count: sequenciasAtivas } = await service
      .from('follow_sequences')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('ativo', true)

    // ── Trial SaaS
    const { data: trials } = await service
      .from('saas_trials')
      .select('id, nome, whatsapp, status, estagio, criado_em, trial_days')
      .eq('company_id', companyId)
      .order('criado_em', { ascending: false })

    const trialsAtivos = (trials ?? []).filter((t: any) => t.status === 'ativo')
    const trialsExpirados = (trials ?? []).filter((t: any) => t.status === 'expirado')
    const trialsConvertidos = (trials ?? []).filter((t: any) => t.status === 'convertido')

    const porEstagioMap: Record<string, number> = {}
    for (const t of trialsAtivos) {
      const est = (t as any).estagio ?? 'sem_estagio'
      porEstagioMap[est] = (porEstagioMap[est] ?? 0) + 1
    }
    const porEstagio = Object.entries(porEstagioMap).map(([estagio, count]) => ({ estagio, count }))

    const trialLista = trialsAtivos.slice(0, 30).map((t: any) => ({
      id: t.id,
      nome: t.nome,
      whatsapp: t.whatsapp,
      status: t.status,
      estagio: t.estagio ?? null,
      dia_no_trial: Math.floor((Date.now() - new Date(t.criado_em).getTime()) / 86_400_000),
      trial_days: t.trial_days ?? 14,
      criado_em: t.criado_em,
    }))

    // ── Remarketing
    const { data: remarketingLeads } = await service
      .from('leads')
      .select('id, contact_name, whatsapp, status, updated_at')
      .eq('company_id', companyId)
      .eq('status', 'Remarketing')
      .order('updated_at', { ascending: false })
      .limit(30)

    const { count: remarketingResponderam } = await service
      .from('follow_logs')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('tipo', 'remarketing')
      .eq('respondeu', true)
      .gte('enviado_em', sinceIso)

    // ── Últimas execuções (tabela)
    const ultimasExecucoes = recentLogs.map((l: any) => ({
      id: l.id,
      tipo: l.tipo,
      label: TIPO_LABELS[l.tipo] ?? l.tipo,
      lead_name: l.leads?.contact_name ?? '—',
      lead_status: l.leads?.status ?? '—',
      lead_whatsapp: l.leads?.whatsapp ?? '',
      mensagem: (l.mensagem ?? '').slice(0, 100) + ((l.mensagem?.length ?? 0) > 100 ? '…' : ''),
      enviado_em: l.enviado_em,
      respondeu: l.respondeu ?? false,
      resposta: l.respondeu ? (respostasMap[l.lead_id] ?? null) : null,
    }))

    return NextResponse.json({
      periodo,
      overview: {
        total_enviados: totalEnviados,
        total_falhas: totalFalhas,
        total_responderam: totalResponderam,
        taxa_resposta: totalEnviados > 0 ? Math.round((totalResponderam / totalEnviados) * 100) : 0,
        sequencias_ativas: sequenciasAtivas ?? 0,
        trials_ativos: trialsAtivos.length,
        leads_remarketing: remarketingLeads?.length ?? 0,
      },
      por_dia: porDia,
      por_tipo: porTipo,
      trial: {
        ativos: trialsAtivos.length,
        expirados: trialsExpirados.length,
        convertidos: trialsConvertidos.length,
        por_estagio: porEstagio,
        lista: trialLista,
      },
      remarketing: {
        total: remarketingLeads?.length ?? 0,
        responderam: remarketingResponderam ?? 0,
        lista: (remarketingLeads ?? []).map((l: any) => ({
          id: l.id,
          nome: l.contact_name ?? '—',
          whatsapp: l.whatsapp ?? '',
          status: l.status,
          updated_at: l.updated_at,
        })),
      },
      ultimas_execucoes: ultimasExecucoes,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
