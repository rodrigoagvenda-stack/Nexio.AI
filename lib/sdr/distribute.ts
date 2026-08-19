// Peça C do plano "máquina de vendas completa": motor de distribuição de
// conversas pra atendentes, extraído de app/api/conversations/distribute/route.ts
// pra poder ser chamado tanto pela rota HTTP (cron/manual, autenticado) quanto
// direto de dentro do engine.ts no momento do handoff (Pausar_conversa),
// sem precisar de uma requisição HTTP autenticada em background.
import { createServiceClient } from '@/lib/supabase/server'

type Supabase = ReturnType<typeof createServiceClient>

export interface DistributeResult {
  assigned: number
  reattributed: number
  reason?: string
}

export async function distributeQueuedConversations(companyId: number, supabase: Supabase): Promise<DistributeResult> {
  const { data: rules } = await supabase
    .from('distribution_rules')
    .select('*')
    .eq('company_id', companyId)
    .eq('active', true)
    .maybeSingle()

  const strategy: string = rules?.strategy ?? 'by_load'
  const warmUpMinutes: number = rules?.warm_up_minutes ?? 5
  const reattributionMinutes: number = rules?.reassign_minutes ?? 10

  const { data: attendants } = await supabase
    .from('attendants')
    .select('id, name, online')
    .eq('company_id', companyId)
    .eq('active', true)

  if (!attendants?.length) return { assigned: 0, reattributed: 0, reason: 'no_attendants' }

  const { data: limitsData } = await supabase
    .from('attendant_limits')
    .select('attendant_id, max_concurrent_conversations')

  const limitsMap: Record<string, number> = {}
  for (const l of limitsData ?? []) limitsMap[l.attendant_id] = l.max_concurrent_conversations

  const { data: activeConvs } = await supabase
    .from('conversas_do_whatsapp')
    .select('current_attendant_id')
    .eq('company_id', companyId)
    .in('current_status', ['em_atendimento', 'aguardando_retorno'])

  const activeByAttendant: Record<string, number> = {}
  for (const c of activeConvs ?? []) {
    if (c.current_attendant_id) {
      activeByAttendant[c.current_attendant_id] = (activeByAttendant[c.current_attendant_id] ?? 0) + 1
    }
  }

  let available = attendants.filter(att => {
    const max = limitsMap[att.id] ?? 15
    const current = activeByAttendant[att.id] ?? 0
    return current < max
  })

  if (!available.length) return { assigned: 0, reattributed: 0, reason: 'all_attendants_at_capacity' }

  if (strategy === 'by_load' || strategy === 'by_availability') {
    const online = available.filter(att => att.online)
    if (online.length) available = online
  }

  const queueThreshold = new Date(Date.now() - warmUpMinutes * 60 * 1000).toISOString()
  const { data: queued } = await supabase
    .from('conversas_do_whatsapp')
    .select('id, created_at:criado_em, queue_entered_at')
    .eq('company_id', companyId)
    .in('current_status', ['livre', 'sdr'])
    .is('current_attendant_id', null)
    .in('kanban_stage', ['fila', 'novo'])
    .lte('criado_em', queueThreshold)
    .order('queue_entered_at', { ascending: true, nullsFirst: false })
    .limit(50)

  let assigned = 0
  if (queued?.length) {
    let attendantIdx = 0
    if (strategy === 'by_load' || strategy === 'by_availability') {
      available.sort((a, b) => (activeByAttendant[a.id] ?? 0) - (activeByAttendant[b.id] ?? 0))
    }

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
  }

  const reattribThreshold = new Date(Date.now() - reattributionMinutes * 60 * 1000).toISOString()
  const { data: stale } = await supabase
    .from('conversas_do_whatsapp')
    .select('id, current_attendant_id')
    .eq('company_id', companyId)
    .eq('current_status', 'em_atendimento')
    .not('current_attendant_id', 'is', null)
    .lte('hora_da_ultima_mensagem', reattribThreshold)
    .limit(10)

  let reattributed = 0
  for (const conv of stale ?? []) {
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

  return { assigned, reattributed }
}

// Rede de segurança do cron (*/5min): cobre reatribuição de conversa parada
// e qualquer conversa que tenha entrado na fila por um caminho que não passa
// pelo handoff em tempo real do engine.ts (ex.: movida manualmente pro Kanban).
export async function runDistributeAll(): Promise<{ companies: number; assigned: number; reattributed: number; errors: string[] }> {
  const supabase = createServiceClient()
  const errors: string[] = []
  let totalAssigned = 0
  let totalReattributed = 0
  let companiesProcessed = 0

  const { data: companyIds } = await supabase
    .from('attendants')
    .select('company_id')
    .eq('active', true)

  const uniqueIds = Array.from(new Set((companyIds ?? []).map(c => c.company_id)))

  for (const companyId of uniqueIds) {
    try {
      const result = await distributeQueuedConversations(companyId, supabase)
      totalAssigned += result.assigned
      totalReattributed += result.reattributed
      companiesProcessed++
    } catch (err: any) {
      errors.push(`company=${companyId}: ${err.message}`)
    }
  }

  return { companies: companiesProcessed, assigned: totalAssigned, reattributed: totalReattributed, errors }
}
