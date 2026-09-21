/**
 * Rodada de uma sequência de etiqueta (Follow up, No-show, Promoção). Função PURA.
 *
 * follow_executions guarda um envio por (lead, passo) e nunca é apagada. Sem esta regra, um lead que já
 * passou pela sequência não recebia nada quando a etiqueta era aplicada de novo (achado ao vivo 2026-09-21,
 * lead de teste do Rodrigo). Só contam como "já enviados" os passos feitos DEPOIS de a etiqueta atual ter
 * sido aplicada; o histórico continua no banco.
 */
export interface ExecRow {
  lead_id: number
  step_id: string
  disparado_em?: string | null
}

/** Passos já enviados por lead na rodada atual. tagAppliedAt: lead -> instante (ms) da etiqueta; vazio = sem rodadas (conta tudo). */
export function firedStepsByLead(execs: ExecRow[], tagAppliedAt: Map<number, number>): Map<number, Set<string>> {
  const fired = new Map<number, Set<string>>()
  for (const ex of execs) {
    const desde = tagAppliedAt.get(ex.lead_id)
    if (desde !== undefined && ex.disparado_em && new Date(ex.disparado_em).getTime() < desde) continue
    if (!fired.has(ex.lead_id)) fired.set(ex.lead_id, new Set())
    fired.get(ex.lead_id)!.add(ex.step_id)
  }
  return fired
}
