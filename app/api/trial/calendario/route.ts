import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { addDays, format, parseISO } from 'date-fns'

export async function GET(req: NextRequest) {
  const { context, error: authError } = await requireAuth(req)
  if (authError) return authError

  const service = createServiceClient()
  const companyId = context.companyId

  // Active trials + their sequence steps
  const [{ data: trials }, { data: sequences }] = await Promise.all([
    service
      .from('saas_trials')
      .select('id, nome, email, whatsapp, status, criado_em, trial_days, respondeu')
      .eq('company_id', companyId)
      .in('status', ['ativo', 'convertido', 'expirado'])
      .order('criado_em', { ascending: false })
      .limit(200),
    service
      .from('follow_sequences')
      .select('id, nome, tipo, ativo, follow_steps(id, dia_offset, horario, tipo_mensagem, condicao, ordem)')
      .eq('company_id', companyId)
      .eq('tipo', 'trial_saas')
      .eq('ativo', true)
      .order('criado_em', { ascending: false })
      .limit(1),
  ])

  const steps = (sequences?.[0]?.follow_steps ?? []) as Array<{
    id: string; dia_offset: number; horario: string; tipo_mensagem: string; condicao: string; ordem: number;
  }>

  // Build calendar events
  const events = (trials ?? []).flatMap((trial) => {
    const base = parseISO(trial.criado_em)
    return steps.map((step) => {
      const date = addDays(base, step.dia_offset)
      const [h, m] = (step.horario ?? '09:00').split(':')
      date.setHours(Number(h), Number(m), 0, 0)
      return {
        id: `${trial.id}-${step.id}`,
        trialId: trial.id,
        leadName: trial.nome,
        leadWhatsapp: trial.whatsapp,
        trialStatus: trial.status,
        trialDays: trial.trial_days ?? 7,
        createdAt: trial.criado_em,
        stepId: step.id,
        stepOffset: step.dia_offset,
        stepType: step.tipo_mensagem,
        stepCondition: step.condicao,
        stepOrder: step.ordem,
        date: format(date, "yyyy-MM-dd'T'HH:mm:ss"),
        dateStr: format(date, 'yyyy-MM-dd'),
      }
    })
  })

  return NextResponse.json({ events, trialsTotal: trials?.length ?? 0 })
}
