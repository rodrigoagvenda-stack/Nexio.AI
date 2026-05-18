import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'

type SequenceTipo = 'follow_geral' | 'anti_noshow' | 'remarketing' | 'trial_saas'

interface AgendaEvent {
  id: string
  leadName: string
  leadCount: number
  sequenceName: string
  sequenceTipo: SequenceTipo
  horario: string
  tipoMensagem: string
  dia: string // ISO date string
}

function toSequenceTipo(tipo: string): SequenceTipo {
  const allowed: SequenceTipo[] = ['follow_geral', 'anti_noshow', 'remarketing', 'trial_saas']
  return allowed.includes(tipo as SequenceTipo) ? (tipo as SequenceTipo) : 'follow_geral'
}

/**
 * GET /api/follow/agenda
 * Retorna todos os steps de sequências ativas com dia absoluto calculado = hoje + dia_offset.
 */
export async function GET(request: NextRequest) {
  const { context, error: authError } = await requireAuth(request)
  if (authError) return authError

  try {
    const service = createServiceClient()

    // Buscar sequências ativas com seus steps
    const { data: sequences, error: seqErr } = await service
      .from('follow_sequences')
      .select('id, nome, tipo, follow_steps (id, dia_offset, horario, tipo_mensagem, ordem)')
      .eq('company_id', context.companyId)
      .eq('ativo', true)
      .order('created_at', { ascending: true })

    if (seqErr) throw seqErr

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const events: AgendaEvent[] = []

    for (const seq of sequences ?? []) {
      const steps = (seq.follow_steps as Array<{
        id: string
        dia_offset: number
        horario: string
        tipo_mensagem: string
        ordem: number
      }>) ?? []

      for (const step of steps) {
        // Calcular data absoluta = hoje + dia_offset
        const diaAbsoluto = new Date(today)
        diaAbsoluto.setDate(diaAbsoluto.getDate() + step.dia_offset)

        events.push({
          id: `${seq.id}-${step.id}`,
          leadName: 'Leads desta sequência',
          leadCount: 0,
          sequenceName: seq.nome as string,
          sequenceTipo: toSequenceTipo(seq.tipo as string),
          horario: step.horario ?? '09:00',
          tipoMensagem: step.tipo_mensagem ?? 'text',
          dia: diaAbsoluto.toISOString(),
        })
      }
    }

    // Ordenar por data e horário
    events.sort((a, b) => {
      const dateCompare = a.dia.localeCompare(b.dia)
      if (dateCompare !== 0) return dateCompare
      return a.horario.localeCompare(b.horario)
    })

    return NextResponse.json({ events })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
