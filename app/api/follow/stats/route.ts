import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'

export async function GET(request: NextRequest) {
  const { context, error: authError } = await requireAuth(request)
  if (authError) return authError

  try {
    const service = createServiceClient()
    const companyId = context.companyId

    const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString()

    // Totais por tipo (últimos 30 dias)
    const { data: executions } = await service
      .from('follow_executions')
      .select('status, sequence_id, disparado_em, follow_sequences!inner(tipo, nome)')
      .eq('company_id', companyId)
      .gte('disparado_em', thirtyDaysAgo)

    const porTipo: Record<string, { tipo: string; label: string; enviados: number; falhas: number; pulados: number }> = {}
    let totalEnviados = 0
    let totalFalhas = 0

    for (const ex of executions ?? []) {
      const seq = (ex as any).follow_sequences
      const tipo = seq?.tipo ?? 'desconhecido'
      const nome = seq?.nome ?? tipo
      if (!porTipo[tipo]) {
        porTipo[tipo] = { tipo, label: TIPO_LABELS[tipo] ?? tipo, enviados: 0, falhas: 0, pulados: 0 }
      }
      if (ex.status === 'sent') { porTipo[tipo].enviados++; totalEnviados++ }
      else if (ex.status === 'failed') { porTipo[tipo].falhas++; totalFalhas++ }
      else { porTipo[tipo].pulados++ }
    }

    // Total de respondeu nos últimos 30 dias (count real no banco)
    const { count: totalRespondeu } = await service
      .from('follow_logs')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('respondeu', true)
      .gte('enviado_em', thirtyDaysAgo)

    // Últimos logs com info do lead
    const { data: recentLogs } = await service
      .from('follow_logs')
      .select('id, tipo, mensagem, enviado_em, respondeu, lead_id, leads!inner(id, contact_name, status, whatsapp)')
      .eq('company_id', companyId)
      .order('enviado_em', { ascending: false })
      .limit(20)

    // Para logs que tiveram resposta, busca a mensagem inbound mais recente do lead
    const respondedLeadIds = (recentLogs ?? [])
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

      // Pega a mensagem mais recente por lead
      for (const r of respostas ?? []) {
        if (!respostasMap[r.id_do_lead]) {
          respostasMap[r.id_do_lead] = r.texto_da_mensagem ?? ''
        }
      }
    }

    const ultimos = (recentLogs ?? []).map((l: any) => ({
      id: l.id,
      tipo: l.tipo,
      lead_id: l.lead_id,
      lead_name: l.leads?.contact_name ?? '—',
      lead_status: l.leads?.status ?? '—',
      mensagem: l.mensagem?.slice(0, 80) + (l.mensagem?.length > 80 ? '…' : ''),
      enviado_em: l.enviado_em,
      respondeu: l.respondeu ?? false,
      resposta: l.respondeu ? (respostasMap[l.lead_id] ?? null) : null,
    }))

    // Sequências ativas
    const { count: sequenciasAtivas } = await service
      .from('follow_sequences')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('ativo', true)

    return NextResponse.json({
      periodo: '30_dias',
      total_enviados: totalEnviados,
      total_falhas: totalFalhas,
      total_respondeu: totalRespondeu ?? 0,
      sequencias_ativas: sequenciasAtivas ?? 0,
      por_tipo: Object.values(porTipo),
      ultimos,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

const TIPO_LABELS: Record<string, string> = {
  follow_geral: 'Follow Geral',
  anti_noshow: 'Anti-Noshow',
  remarketing: 'Remarketing',
  follow_proposta: 'Follow Proposta',
}
