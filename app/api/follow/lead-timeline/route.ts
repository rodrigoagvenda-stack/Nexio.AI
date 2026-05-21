import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { context, error: authError } = await requireAuth(request)
  if (authError) return authError

  const leadId = request.nextUrl.searchParams.get('lead_id')
  if (!leadId) return NextResponse.json({ error: 'lead_id obrigatório' }, { status: 400 })

  try {
    const service = createServiceClient()

    // Buscar sequências ativas que contêm este lead (via execuções ou steps pendentes)
    const { data: sequences, error: seqErr } = await service
      .from('follow_sequences')
      .select(`
        id, nome, tipo, ativo,
        follow_steps (id, dia_offset, horario, tipo_mensagem, ordem)
      `)
      .eq('company_id', context.companyId)
      .order('created_at', { ascending: true })

    if (seqErr) throw seqErr

    // Buscar execuções disparadas para este lead
    const { data: execucoes, error: execErr } = await service
      .from('follow_executions')
      .select('step_id, sequence_id, disparado_em, status')
      .eq('lead_id', parseInt(leadId))

    if (execErr) throw execErr

    const executedStepIds = new Set((execucoes ?? []).map((e) => e.step_id))
    const executedByStep = new Map(
      (execucoes ?? []).map((e) => [e.step_id, e])
    )

    // Montar timeline por sequência
    const timeline = (sequences ?? [])
      .filter((seq) => {
        const steps = (seq.follow_steps as Array<{ id: string }>) ?? []
        // Inclui sequência se há ao menos um step disparado para este lead
        return steps.some((s) => executedStepIds.has(s.id))
      })
      .map((seq) => {
        const steps = (
          seq.follow_steps as Array<{
            id: string
            dia_offset: number
            horario: string
            tipo_mensagem: string
            ordem: number
          }>
        ).sort((a, b) => a.ordem - b.ordem)

        return {
          sequenceId: seq.id,
          sequenceName: seq.nome,
          sequenceTipo: seq.tipo,
          sequenceAtivo: seq.ativo,
          steps: steps.map((s) => ({
            stepId: s.id,
            diaOffset: s.dia_offset,
            horario: s.horario,
            tipoMensagem: s.tipo_mensagem,
            ordem: s.ordem,
            disparado: executedStepIds.has(s.id),
            disparadoEm: executedByStep.get(s.id)?.disparado_em ?? null,
            status: executedByStep.get(s.id)?.status ?? null,
          })),
        }
      })

    return NextResponse.json({ timeline })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
