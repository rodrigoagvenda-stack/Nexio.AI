import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { logCompanyNotice } from '@/lib/notifications/server'
import { relatorioSemanal } from '@/lib/sdr/v3/metrics'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * GET /api/cron/sdr-v3-metrics
 * Métricas semanais do SDR v3 (spec seção 1) para cada empresa com a flag sdr_v3 ligada: grava o resumo no sino
 * e devolve o relatório completo. Configurar no Easypanel:
 *   Method: GET, Header: Authorization: Bearer CRON_SECRET, Intervalo: segunda-feira de manhã.
 */
export async function GET(request: NextRequest) {
  const expected = process.env.CRON_SECRET
  if (!expected) return NextResponse.json({ error: 'CRON_SECRET não configurado' }, { status: 500 })
  if (request.headers.get('authorization') !== `Bearer ${expected}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: companies } = await supabase.from('companies').select('id, name, features').eq('is_active', true).eq('is_shadow_company', false)
  const alvo = (companies ?? []).filter((c) => (c.features as Record<string, unknown> | null)?.sdr_v3 === true)

  const resultados: Record<string, unknown> = {}
  for (const c of alvo) {
    try {
      const rel = await relatorioSemanal(supabase, c.id as number, 14)
      resultados[String(c.id)] = rel
      const a = rel.atual
      const ant = rel.anterior
      await logCompanyNotice(supabase, {
        companyId: c.id as number,
        action: 'sdr_v3_metricas_semanais',
        description:
          `SDR, últimos ${rel.dias} dias (antes): valor em R$ ${a.valor_em_reais_pelo_sdr} (${ant.valor_em_reais_pelo_sdr}), ` +
          `2+ perguntas ${a.mensagens_com_2_ou_mais_perguntas} (${ant.mensagens_com_2_ou_mais_perguntas}), ` +
          `frases repetidas ${a.frases_repetidas_na_conversa} (${ant.frases_repetidas_na_conversa}), ` +
          `promessa de agendamento sem evento ${a.agendamento_prometido_sem_evento} (${ant.agendamento_prometido_sem_evento}), ` +
          `agendamentos ${a.agendamentos_criados} (${ant.agendamentos_criados}).`,
        metadata: { relatorio: rel },
      })
    } catch (e: any) {
      resultados[String(c.id)] = { erro: e?.message ?? 'erro' }
    }
  }
  return NextResponse.json({ success: true, empresas: alvo.length, resultados })
}
