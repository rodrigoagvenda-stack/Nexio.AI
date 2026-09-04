// Funil de mensagens (profundidade de conversa) reportado pela Meta Insights
// API pra campanhas de clique-para-WhatsApp. O dado bruto já é sincronizado
// por lib/sdr/meta-ads-sync.ts em meta_ad_insights.raw (campo "actions" da
// resposta da Meta), só nunca tinha sido parseado.
//
// Os action_type abaixo seguem a convenção documentada da Meta pra métricas
// de mensageria (onsite_conversion.*), mas nunca foram conferidos contra uma
// resposta real desta conta -- por isso o parser busca por trecho do nome
// (includes), não igualdade exata, e getMessageFunnelDiagnostics devolve os
// action_type que NÃO bateram em nenhum bucket, pra conferência manual assim
// que houver dado real sincronizado.

export interface MetaAction {
  action_type?: string
  value?: string | number
}

export interface MessageFunnelStage {
  key: string
  label: string
  count: number
  /**
   * Conferido ao vivo (Rodrigo, 2026-09-04) com dado real : "funil" são
   * marcos sequenciais por conversa (uma conta por conversa), dá pra tratar
   * como funil de verdade com % de queda entre etapas. "profundidade" é
   * volume de MENSAGENS enviadas depois que a conversa atingiu aquela
   * profundidade -- não é contagem de pessoas, pode passar do estágio
   * anterior sem que nada esteja errado (ex: depth_5 > depth_3 é normal).
   * Renderizar como % de queda junto do funil real é que gerava número
   * bizarro tipo "243%".
   */
  group: 'funil' | 'profundidade'
}

const STAGE_MATCHERS: { key: string; label: string; group: 'funil' | 'profundidade'; match: (actionType: string) => boolean }[] = [
  { key: 'conversas_iniciadas', label: 'Conversas iniciadas', group: 'funil', match: (t) => t.includes('messaging_conversation_started') },
  { key: 'contatos_por_mensagem', label: 'Contatos por mensagem', group: 'funil', match: (t) => t.includes('total_messaging_connection') },
  { key: 'primeira_resposta', label: 'Primeira resposta da empresa', group: 'funil', match: (t) => t.includes('messaging_first_reply') },
  { key: 'profundidade_2', label: 'Mensagens com 2+ trocas', group: 'profundidade', match: (t) => t.includes('messaging_user_depth_2') },
  { key: 'profundidade_3', label: 'Mensagens com 3+ trocas', group: 'profundidade', match: (t) => t.includes('messaging_user_depth_3') },
  { key: 'profundidade_5', label: 'Mensagens com 5+ trocas', group: 'profundidade', match: (t) => t.includes('messaging_user_depth_5') },
]

function sumActionValue(actions: MetaAction[], matcher: (t: string) => boolean): number {
  return actions
    .filter(a => a.action_type && matcher(a.action_type))
    .reduce((sum, a) => sum + (Number(a.value) || 0), 0)
}

/** Agrega o funil de mensagens a partir de várias linhas raw (uma por ad/dia). */
export function aggregateMessageFunnel(rawRows: unknown[]): MessageFunnelStage[] {
  const allActions: MetaAction[] = []
  for (const raw of rawRows) {
    if (Array.isArray(raw)) allActions.push(...(raw as MetaAction[]))
  }
  return STAGE_MATCHERS.map(s => ({
    key: s.key,
    label: s.label,
    group: s.group,
    count: sumActionValue(allActions, s.match),
  }))
}

/** Lista os action_type que não bateram em nenhum matcher -- diagnóstico pra conferir nome real. */
export function getUnmatchedActionTypes(rawRows: unknown[]): string[] {
  const allActions: MetaAction[] = []
  for (const raw of rawRows) {
    if (Array.isArray(raw)) allActions.push(...(raw as MetaAction[]))
  }
  const matched = new Set<string>()
  for (const a of allActions) {
    if (!a.action_type) continue
    if (STAGE_MATCHERS.some(s => s.match(a.action_type!))) matched.add(a.action_type)
  }
  const unique = Array.from(new Set(allActions.map(a => a.action_type).filter(Boolean))) as string[]
  return unique.filter(t => !matched.has(t))
}
