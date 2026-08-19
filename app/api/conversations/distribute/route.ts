import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'

// Distribui conversas da fila para atendentes livres respeitando limites por atendente.
// Pode ser chamado via POST por: webhook após handoff, cron a cada 5min, ou manualmente.
export async function POST(req: NextRequest) {
  const { context, error: authError } = await requireAuth(req)
  if (authError) return authError

  const supabase = createServiceClient()

  // Carregar regras de distribuição da empresa
  const { data: rules } = await supabase
    .from('distribution_rules')
    .select('*')
    .eq('company_id', context.companyId)
    .eq('active', true)
    .maybeSingle()

  const strategy: string = rules?.strategy ?? 'by_load'
  const warmUpMinutes: number = rules?.warm_up_minutes ?? 5
  const reattributionMinutes: number = rules?.reassign_minutes ?? 10

  // Atendentes ativos com seus limites
  const { data: attendants } = await supabase
    .from('attendants')
    .select('id, name, online')
    .eq('company_id', context.companyId)
    .eq('active', true)

  if (!attendants?.length) return NextResponse.json({ assigned: 0, reason: 'no_attendants' })

  const { data: limitsData } = await supabase
    .from('attendant_limits')
    .select('attendant_id, max_concurrent_conversations')

  const limitsMap: Record<string, number> = {}
  for (const l of limitsData ?? []) limitsMap[l.attendant_id] = l.max_concurrent_conversations

  // Conversas ativas por atendente
  const { data: activeConvs } = await supabase
    .from('conversas_do_whatsapp')
    .select('current_attendant_id')
    .eq('company_id', context.companyId)
    .in('current_status', ['em_atendimento', 'aguardando_retorno'])

  const activeByAttendant: Record<string, number> = {}
  for (const c of activeConvs ?? []) {
    if (c.current_attendant_id) {
      activeByAttendant[c.current_attendant_id] = (activeByAttendant[c.current_attendant_id] ?? 0) + 1
    }
  }

  // Filtrar atendentes com capacidade disponível
  let available = attendants.filter(att => {
    const max = limitsMap[att.id] ?? 15
    const current = activeByAttendant[att.id] ?? 0
    return current < max
  })

  if (!available.length) return NextResponse.json({ assigned: 0, reason: 'all_attendants_at_capacity' })

  // by_load/by_availability: prioriza quem está online, mas nunca zera a fila
  // por isso -- se ninguém marcou presença online ainda, cai pra todos com
  // capacidade (comportamento de hoje), sem regressão pra empresa que não usa o toggle.
  if (strategy === 'by_load' || strategy === 'by_availability') {
    const online = available.filter(att => att.online)
    if (online.length) available = online
  }

  // Conversas na fila aguardando atendente (fila ou novo sem atendente)
  const queueThreshold = new Date(Date.now() - warmUpMinutes * 60 * 1000).toISOString()
  const { data: queued } = await supabase
    .from('conversas_do_whatsapp')
    .select('id, created_at:criado_em, queue_entered_at')
    .eq('company_id', context.companyId)
    .in('current_status', ['livre', 'sdr'])
    .is('current_attendant_id', null)
    .in('kanban_stage', ['fila', 'novo'])
    .lte('criado_em', queueThreshold)
    .order('queue_entered_at', { ascending: true, nullsFirst: false })
    .limit(50)

  if (!queued?.length) return NextResponse.json({ assigned: 0, reason: 'no_queued_conversations' })

  // Escolher próximo atendente baseado na strategy
  let attendantIdx = 0
  if (strategy === 'by_load' || strategy === 'by_availability') {
    available.sort((a, b) => (activeByAttendant[a.id] ?? 0) - (activeByAttendant[b.id] ?? 0))
  }

  let assigned = 0
  for (const conv of queued) {
    const att = available[attendantIdx % available.length]
    const currentLoad = activeByAttendant[att.id] ?? 0
    const max = limitsMap[att.id] ?? 15

    if (currentLoad >= max) {
      attendantIdx++
      if (attendantIdx >= available.length) break
      continue
    }

    await supabase
      .from('conversas_do_whatsapp')
      .update({
        current_attendant_id: att.id,
        current_status: 'em_atendimento',
        kanban_stage: 'em_atendimento',
      })
      .eq('id', conv.id)

    await supabase.from('conversation_assignments').insert({
      conversation_id: conv.id,
      attendant_id: att.id,
      assigned_at: new Date().toISOString(),
    })

    activeByAttendant[att.id] = currentLoad + 1
    assigned++

    if (strategy === 'round_robin') attendantIdx++
  }

  // Reateribuição: conversas em_atendimento paradas há mais tempo que reattributionMinutes
  const reattribThreshold = new Date(Date.now() - reattributionMinutes * 60 * 1000).toISOString()
  const { data: stale } = await supabase
    .from('conversas_do_whatsapp')
    .select('id, current_attendant_id')
    .eq('company_id', context.companyId)
    .eq('current_status', 'em_atendimento')
    .not('current_attendant_id', 'is', null)
    .lte('hora_da_ultima_mensagem', reattribThreshold)
    .limit(10)

  let reattributed = 0
  for (const conv of stale ?? []) {
    // Release to queue
    await supabase
      .from('conversas_do_whatsapp')
      .update({ current_attendant_id: null, current_status: 'livre', kanban_stage: 'fila' })
      .eq('id', conv.id)

    await supabase
      .from('conversation_assignments')
      .update({ released_at: new Date().toISOString() })
      .eq('conversation_id', conv.id)
      .is('released_at', null)

    reattributed++
  }

  return NextResponse.json({ assigned, reattributed })
}
