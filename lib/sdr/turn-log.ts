import type { createServiceClient } from '@/lib/supabase/server'

type Supabase = ReturnType<typeof createServiceClient>

export interface TurnTrace {
  startedAt: number
  tools: { nome: string; args: string }[]
  rag: { base: 'conhecimento' | 'objecoes'; query: string; vazio: boolean; tamanho: number }[]
  checklistAntes: unknown
}

export function newTurnTrace(checklistAntes: unknown): TurnTrace {
  return { startedAt: Date.now(), tools: [], rag: [], checklistAntes: checklistAntes ?? null }
}

export interface TurnLogInput {
  companyId: number
  conversationId: string | null
  leadId: number
  trace: TurnTrace | undefined
  checklistDepois: unknown
  blocosRedator: string[]
  violacoes: unknown[]
  blocosEnviados: string[]
  usage: { totalTokens: number }[]
  desfecho: 'enviado' | 'guarda_suprimiu_tudo' | 'sem_resposta'
}

/** Um registro por turno do motor atual (engine='atual'). Nunca derruba o turno: erro só vai pro console. */
export async function writeTurnLog(supabase: Supabase, i: TurnLogInput): Promise<void> {
  try {
    if (!i.conversationId) return
    const conv = Number(i.conversationId)
    if (!Number.isFinite(conv)) return
    const { count } = await supabase
      .from('sdr_turn_log')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', i.companyId)
      .eq('conversation_id', conv)
    const t = i.trace
    await supabase.from('sdr_turn_log').insert({
      company_id: i.companyId,
      conversation_id: conv,
      lead_id: i.leadId,
      turno: (count ?? 0) + 1,
      engine: 'atual',
      estado_antes: t?.checklistAntes ?? null,
      estado_depois: i.checklistDepois ?? null,
      acao: { ferramentas: t?.tools ?? [], desfecho: i.desfecho },
      fatos_recuperados: t?.rag ?? [],
      redator_blocos: i.blocosRedator,
      validador_violacoes: i.violacoes,
      regenerou: false,
      blocos_enviados: i.blocosEnviados,
      modelo: 'gpt-4.1',
      tokens: i.usage.reduce((s, u) => s + (u.totalTokens ?? 0), 0),
      latencia_ms: t ? Date.now() - t.startedAt : null,
      config_version: null,
    })
  } catch (err) {
    console.error('[SDR turn-log] falha ao gravar (ignorada):', err)
  }
}
