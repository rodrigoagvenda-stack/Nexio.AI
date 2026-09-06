/**
 * Reengajamento automático de conversas em fila por fora-do-horário.
 *
 * Achado ao vivo (Rodrigo, 2026-09-06) : quando o lead escreve fora do
 * horário configurado, a conversa recebe a mensagem de ausência e vai pra
 * fila (lib/sdr/engine.ts, bloco "Horários de atendimento"). Mas depois que
 * o horário reabre, NADA retomava essas conversas sozinho : o SDR só
 * respondia se o próprio lead escrevesse de novo. Isso deixava lead
 * qualificado esperando sem necessidade, mesmo já dentro do horário.
 *
 * Esse cron acha conversas em fila por esse motivo especificamente (fila +
 * agente_pausado=false : distingue de fila por handoff humano, que sempre
 * marca agente_pausado=true) e reprocessa a última mensagem do lead pelo
 * motor de verdade, assim que a empresa volta a estar dentro do horário.
 */
import { createServiceClient } from '@/lib/supabase/server'
import { isWithinBusinessHours } from './business-hours'
import { bufferMessage, processSdrMessage, type BufferedMessage } from './engine'

type Supabase = ReturnType<typeof createServiceClient>

export async function runReengageFila(): Promise<{ companies: number; processed: number; errors: string[] }> {
  const supabase: Supabase = createServiceClient()
  const errors: string[] = []
  let processed = 0
  let companiesComReengajamento = 0

  const { data: companies } = await supabase
    .from('companies')
    .select('id')
    .eq('is_active', true)

  for (const company of companies ?? []) {
    try {
      const within = await isWithinBusinessHours(company.id, supabase)
      if (!within) continue

      const { data: filaConvs } = await supabase
        .from('conversas_do_whatsapp')
        .select('id, numero_de_telefone')
        .eq('company_id', company.id)
        .eq('kanban_stage', 'fila')
        .eq('agente_pausado', false)

      if (!filaConvs?.length) continue
      companiesComReengajamento++

      for (const conv of filaConvs) {
        try {
          const { data: lastInbound } = await supabase
            .from('mensagens_do_whatsapp')
            .select('texto_da_mensagem, tipo_de_mensagem, url_da_midia, whatsapp_message_id')
            .eq('id_da_conversacao', conv.id)
            .eq('direcao', 'inbound')
            .order('carimbo_de_data_e_hora', { ascending: false })
            .limit(1)
            .maybeSingle()

          if (!lastInbound?.texto_da_mensagem) continue

          // Tira da fila antes de reprocessar : evita reprocessar de novo no
          // próximo cron e deixa o Agente_de_Pipeline definir o estágio real
          // durante o próprio reprocessamento.
          await supabase
            .from('conversas_do_whatsapp')
            .update({ kanban_stage: null })
            .eq('id', conv.id)

          const bufferedMsg: BufferedMessage = {
            content: lastInbound.texto_da_mensagem,
            type: lastInbound.tipo_de_mensagem ?? 'text',
            timestamp: new Date().toISOString(),
            mediaUrl: lastInbound.url_da_midia ?? undefined,
            // Reaproveita o messageId original : saveInbound faz dedup por
            // esse id, então não duplica o balão da mensagem no histórico,
            // só dá ao orquestrador algo pra processar de novo.
            messageId: lastInbound.whatsapp_message_id || `reengage-${conv.id}-${Date.now()}`,
          }
          await bufferMessage(company.id, conv.numero_de_telefone, bufferedMsg, supabase)
          await processSdrMessage(company.id, conv.numero_de_telefone)
          processed++
        } catch (err: any) {
          errors.push(`conv=${conv.id}: ${err.message}`)
        }
      }
    } catch (err: any) {
      errors.push(`company=${company.id}: ${err.message}`)
    }
  }

  return { companies: companiesComReengajamento, processed, errors }
}
