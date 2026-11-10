/**
 * Reengajamento específico pro caso de "OpenAI sem crédito" (erro 429, "no credits
 * remaining" / "insufficient_quota").
 *
 * Achado ao vivo (Grupo Venda, 09-10/11/2026): a conta da OpenAI ficou sem crédito e
 * 5 leads (23:04 de ontem até 08:27 de hoje) nunca receberam resposta. O job de cada
 * um ficou marcado como `status: COMPLETED` mesmo tendo falhado (o campo `error` tinha
 * o 429 da OpenAI) — e job COMPLETED nunca é reprocessado por nada no sistema, mesmo
 * depois de recarregar os créditos. Esse cron só pega jobs com essa assinatura de erro
 * ESPECÍFICA (nunca qualquer falha genérica, pra não sair reprocessando em massa outros
 * tipos de erro por engano) e tenta de novo. Se ainda falhar com o mesmo erro (créditos
 * ainda zerados), não é tratado como falha real, só tenta de novo no próximo ciclo.
 *
 * Seguro contra duplicata: antes de reprocessar, confere que a última mensagem da
 * conversa ainda é do lead (inbound). Se já foi respondida por fora (manual ou outro
 * fluxo), pula sem fazer nada.
 */
import { createServiceClient } from '@/lib/supabase/server'
import { bufferMessage, processSdrMessage, type BufferedMessage } from './engine'

type Supabase = ReturnType<typeof createServiceClient>

const OPENAI_NO_CREDIT_SIGNATURE = /no credits remaining|insufficient_quota/i

export async function runReengageOpenaiCredits(): Promise<{ processed: number; errors: string[] }> {
  const supabase: Supabase = createServiceClient()
  const errors: string[] = []
  let processed = 0

  const { data: jobs } = await supabase
    .from('sdr_jobs')
    .select('id, company_id, phone, error')
    .eq('status', 'COMPLETED')
    .not('error', 'is', null)
    .order('created_at', { ascending: false })
    .limit(200)

  const falhados = (jobs ?? []).filter((j) => typeof j.error === 'string' && OPENAI_NO_CREDIT_SIGNATURE.test(j.error))

  for (const job of falhados) {
    try {
      const { data: conv } = await supabase
        .from('conversas_do_whatsapp')
        .select('id')
        .eq('company_id', job.company_id)
        .eq('numero_de_telefone', job.phone)
        .order('hora_da_ultima_mensagem', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (!conv) continue

      const { data: lastMsg } = await supabase
        .from('mensagens_do_whatsapp')
        .select('direcao, texto_da_mensagem, tipo_de_mensagem, url_da_midia, whatsapp_message_id')
        .eq('id_da_conversacao', conv.id)
        .order('carimbo_de_data_e_hora', { ascending: false })
        .limit(1)
        .maybeSingle()
      // Última mensagem já não é mais do lead (já foi respondido por fora): nada a fazer
      if (!lastMsg || lastMsg.direcao !== 'inbound' || !lastMsg.texto_da_mensagem) continue

      const bufferedMsg: BufferedMessage = {
        content: lastMsg.texto_da_mensagem,
        type: lastMsg.tipo_de_mensagem ?? 'text',
        timestamp: new Date().toISOString(),
        mediaUrl: lastMsg.url_da_midia ?? undefined,
        // messageId novo de propósito (igual reengage-fila.ts): saveInbound faz dedup pelo id original,
        // então precisa de um id diferente só pra dar ao orquestrador algo pra processar de novo.
        messageId: `reengage-openai-${conv.id}-${Date.now()}`,
      }
      await bufferMessage(job.company_id, job.phone, bufferedMsg, supabase)
      await processSdrMessage(job.company_id, job.phone)
      processed++
    } catch (err: any) {
      // Créditos ainda zerados : não é erro de verdade, só tenta de novo no próximo ciclo
      if (!OPENAI_NO_CREDIT_SIGNATURE.test(err?.message ?? '')) errors.push(`job=${job.id}: ${err.message}`)
    }
  }

  return { processed, errors }
}
