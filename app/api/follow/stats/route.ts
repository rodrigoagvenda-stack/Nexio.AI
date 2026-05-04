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

    // Últimos logs com info do lead
    const { data: recentLogs } = await service
      .from('follow_logs')
      .select('id, tipo, mensagem, enviado_em, respondeu, leads!inner(contact_name, status)')
      .eq('company_id', companyId)
      .order('enviado_em', { ascending: false })
      .limit(20)

    const ultimos = (recentLogs ?? []).map((l: any) => ({
      id: l.id,
      tipo: l.tipo,
      lead_name: l.leads?.contact_name ?? '—',
      lead_status: l.leads?.status ?? '—',
      mensagem: l.mensagem?.slice(0, 80) + (l.mensagem?.length > 80 ? '…' : ''),
      enviado_em: l.enviado_em,
      respondeu: l.respondeu,
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
