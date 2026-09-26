/** SDR v3: estado da conversa (tabela sdr_conversation_state). Toda query leva company_id no WHERE. */
import type { createServiceClient } from '@/lib/supabase/server'
import { ESTADO_INICIAL, type Estado } from './types'

type Supabase = ReturnType<typeof createServiceClient>

export async function carregarEstado(supabase: Supabase, companyId: number, conversationId: number, configVersion: number): Promise<{ estado: Estado; novo: boolean }> {
  const { data } = await supabase
    .from('sdr_conversation_state')
    .select('etapa, dados, perguntas_feitas, pedidos_de_preco, recusas, objecoes_respondidas, frases_enviadas, ultima_reacao_social_turno, turno, config_version, contadores')
    .eq('company_id', companyId)
    .eq('conversation_id', conversationId)
    .maybeSingle()
  if (!data) return { estado: ESTADO_INICIAL(configVersion), novo: true }
  const base = ESTADO_INICIAL(configVersion)
  return {
    novo: false,
    estado: {
      ...base,
      etapa: data.etapa as Estado['etapa'],
      dados: (data.dados ?? {}) as Estado['dados'],
      perguntas_feitas: (data.perguntas_feitas ?? []) as Estado['perguntas_feitas'],
      pedidos_de_preco: data.pedidos_de_preco ?? 0,
      recusas: data.recusas ?? 0,
      objecoes_respondidas: (data.objecoes_respondidas ?? []) as string[],
      frases_enviadas: (data.frases_enviadas ?? []) as string[],
      ultima_reacao_social_turno: data.ultima_reacao_social_turno ?? 0,
      turno: data.turno ?? 0,
      config_version: configVersion,
      contadores: { ...base.contadores, ...((data.contadores ?? {}) as Partial<Estado['contadores']>) },
    },
  }
}

export async function salvarEstado(supabase: Supabase, companyId: number, conversationId: number, e: Estado): Promise<void> {
  const { error } = await supabase.from('sdr_conversation_state').upsert(
    {
      conversation_id: conversationId,
      company_id: companyId,
      etapa: e.etapa,
      dados: e.dados,
      perguntas_feitas: e.perguntas_feitas,
      pedidos_de_preco: e.pedidos_de_preco,
      recusas: e.recusas,
      objecoes_respondidas: e.objecoes_respondidas,
      frases_enviadas: e.frases_enviadas.slice(-30),
      ultima_reacao_social_turno: e.ultima_reacao_social_turno,
      turno: e.turno,
      config_version: e.config_version,
      contadores: e.contadores,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'conversation_id' },
  )
  if (error) throw new Error(`salvarEstado: ${error.message}`)
}
