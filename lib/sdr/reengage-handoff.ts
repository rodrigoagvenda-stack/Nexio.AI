/**
 * Reengajamento de conversas escaladas pra um humano que ficaram sem resposta.
 *
 * Achado ao vivo (Jonas/conv1023, Grupo Venda, 09/11/2026) : o SDR disse "vou
 * chamar o Bruno" e pausou (agente_pausado=true, pause_reason='pausar_conversa'),
 * mas ninguém pegou a conversa : ela ficou horas na fila, sem dono, e o lead
 * nunca recebeu resposta nenhuma (nem do bot, nem de humano). Pedido do Rodrigo
 * (09/11/2026): depois de 1h sem um humano responder, o SDR manda uma mensagem
 * curta pedindo desculpa pela demora e avisando que o Bruno responde assim que
 * possível. Isso NÃO reativa o funil nem retoma a qualificação : é só um aviso
 * pra o lead não ficar se sentindo ignorado. A pausa continua até um humano
 * de verdade assumir (ou o auto-release de 24h do engine.ts, que é outro
 * mecanismo e continua existindo do jeito que está).
 *
 * Só mexe em pause_reason='pausar_conversa' (handoff automático do decisor).
 * NUNCA mexe em 'humano_assumiu' (um humano escolheu assumir de propósito),
 * nem em 'midia'/'recepcao'/'follow'/'lead_bloqueado' (semânticas diferentes).
 */
import { createServiceClient } from '@/lib/supabase/server'
import { sendRichStepUnified } from './rich-sender'
import { gravarMensagemFollow } from './follow'

type Supabase = ReturnType<typeof createServiceClient>

const HANDOFF_WAIT_MS = 60 * 60 * 1000 // 1h, pedido do Rodrigo

export async function runReengageHandoff(): Promise<{ processed: number; errors: string[] }> {
  const supabase: Supabase = createServiceClient()
  const errors: string[] = []
  let processed = 0
  const cutoff = new Date(Date.now() - HANDOFF_WAIT_MS).toISOString()

  const { data: convs } = await supabase
    .from('conversas_do_whatsapp')
    .select('id, id_do_lead, numero_de_telefone, nome_do_contato, company_id, agente_pausado_em')
    .eq('agente_pausado', true)
    .eq('pause_reason', 'pausar_conversa')
    .is('handoff_reminder_sent_at', null)
    .lt('agente_pausado_em', cutoff)

  for (const conv of convs ?? []) {
    try {
      // mesma checagem do engine.ts (isAgentePausadoAtivo) : se a última mensagem
      // nossa já foi de um humano de verdade, ele está ativo ali, não manda nada
      const { data: ultimaNossa } = await supabase
        .from('mensagens_do_whatsapp')
        .select('sender_type')
        .eq('id_da_conversacao', conv.id)
        .eq('direcao', 'outbound')
        .order('carimbo_de_data_e_hora', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (ultimaNossa?.sender_type === 'human') continue

      const primeiroNome = (conv.nome_do_contato ?? '').trim().split(/\s+/)[0] || ''
      const texto = primeiroNome
        ? `Desculpa a demora, ${primeiroNome}! O Bruno te responde assim que possível.`
        : 'Desculpa a demora! O Bruno te responde assim que possível.'

      await sendRichStepUnified(conv.company_id, conv.numero_de_telefone, 'text', texto)
      await gravarMensagemFollow(conv.id_do_lead, conv.company_id, conv.numero_de_telefone, texto, 'handoff_reminder', supabase, 'text')

      await supabase.from('conversas_do_whatsapp').update({ handoff_reminder_sent_at: new Date().toISOString() }).eq('id', conv.id)
      processed++
    } catch (err: any) {
      errors.push(`conv=${conv.id}: ${err.message}`)
    }
  }

  return { processed, errors }
}
