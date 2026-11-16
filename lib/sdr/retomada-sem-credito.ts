/**
 * Retomada dos leads que ficaram sem resposta porque a OpenAI estava sem crédito (erro 429).
 *
 * Substitui o antigo cron reengage-openai-credits, que DUPLICAVA as mensagens do lead no painel (achado real,
 * Rodrigo, 10/11/2026): ele gravava a última mensagem de novo com um id inventado e, sem marcar quem já tinha
 * sido tentado, repetia a cada 5 minutos enquanto o crédito seguia zerado.
 *
 * Regras desta versão (pedidas pelo Rodrigo, 16/11/2026):
 * - Nunca grava mensagem nova: as mensagens já estão no banco, então vão marcadas como synthetic (o motor não
 *   chama o saveInbound pra elas). Áudio com transcrição pronta vai como texto (sem transcrever de novo).
 * - Pega TODAS as mensagens do lead depois da nossa última resposta, não só a última.
 * - Uma tentativa por lead: o job é "reservado" (status RETOMADO) numa atualização condicional ANTES de
 *   processar. Se dois disparos rodarem juntos, só um consegue reservar. Nunca volta pra fila sozinho.
 * - Nada roda sozinho: não é cron. Primeiro lista (modo listar), o Rodrigo aprova, depois executa só as
 *   conversas aprovadas, em lotes pequenos.
 * - Pula: conversa pausada (Bruno assumiu), conversa em que já respondemos depois da mensagem do lead.
 * - A resposta começa pedindo desculpa pela demora (TEXTO_RETOMADA em v3/turn.ts).
 */
import { createServiceClient } from '@/lib/supabase/server'
import { bufferMessage, processSdrMessage, type BufferedMessage } from './engine'

type Supabase = ReturnType<typeof createServiceClient>

const ERRO_SEM_CREDITO = /no credits remaining|insufficient_quota/i

export interface CandidatoRetomada {
  jobId: number
  phone: string
  conversationId: number
  nome: string | null
  mensagens: { id: number; whatsappId: string | null; texto: string; tipo: string; quando: string; mediaUrl?: string }[]
}

export interface PuladoRetomada {
  phone: string
  motivo: string
}

async function montarCandidato(
  supabase: Supabase,
  companyId: number,
  job: { id: number; phone: string },
): Promise<CandidatoRetomada | PuladoRetomada> {
  const { data: conv } = await supabase
    .from('conversas_do_whatsapp')
    .select('id, nome_do_contato, agente_pausado')
    .eq('company_id', companyId)
    .eq('numero_de_telefone', job.phone)
    .order('hora_da_ultima_mensagem', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!conv) return { phone: job.phone, motivo: 'sem conversa' }
  if (conv.agente_pausado) return { phone: job.phone, motivo: 'SDR pausado nesta conversa (pessoa da equipe assumiu)' }

  const { data: msgs } = await supabase
    .from('mensagens_do_whatsapp')
    .select('id, direcao, texto_da_mensagem, tipo_de_mensagem, url_da_midia, whatsapp_message_id, metadados, carimbo_de_data_e_hora')
    .eq('id_da_conversacao', conv.id)
    .order('carimbo_de_data_e_hora', { ascending: false })
    .limit(30)

  const pendentes: CandidatoRetomada['mensagens'] = []
  for (const m of msgs ?? []) {
    if (m.direcao === 'outbound') break // nossa última resposta: o que vem antes já foi respondido
    if (m.direcao !== 'inbound') continue
    if ((m.whatsapp_message_id ?? '').startsWith('reengage-')) continue // cópias do cron antigo: nunca reprocessa
    const transcricao = (m.metadados as { transcricao?: string } | null)?.transcricao
    const texto = transcricao || m.texto_da_mensagem || ''
    if (!texto.trim() && !m.url_da_midia) continue
    pendentes.unshift({
      id: m.id,
      whatsappId: m.whatsapp_message_id,
      texto,
      tipo: transcricao ? 'text' : m.tipo_de_mensagem ?? 'text',
      quando: m.carimbo_de_data_e_hora,
      // Mídia sem transcrição salva (ex.: áudio que nem chegou a ser transcrito porque a OpenAI recusou): manda a
      // url pro motor transcrever/descrever agora. Com transcrição, vai só o texto.
      mediaUrl: transcricao ? undefined : m.url_da_midia ?? undefined,
    })
  }
  if (pendentes.length === 0) return { phone: job.phone, motivo: 'já respondido depois da mensagem do lead' }

  return { jobId: job.id, phone: job.phone, conversationId: conv.id, nome: conv.nome_do_contato ?? null, mensagens: pendentes }
}

async function jobsSemCredito(supabase: Supabase, companyId: number, desde: string) {
  const { data } = await supabase
    .from('sdr_jobs')
    .select('id, phone, error')
    .eq('company_id', companyId)
    .eq('status', 'COMPLETED')
    // last_message_at, não created_at: o job é um por telefone e é reaproveitado, então um lead antigo que voltou a
    // falar durante a falta de crédito tem job criado lá atrás (bug real 16/11/2026: Marco 1067, Mark Rio 899 e
    // Anarela 1068 ficaram de fora da retomada).
    .gte('last_message_at', desde)
    .not('error', 'is', null)
  return (data ?? []).filter((j) => ERRO_SEM_CREDITO.test(j.error ?? ''))
}

/** Só lê: nada é enviado nem marcado. */
export async function listarRetomada(companyId: number, desde: string) {
  const supabase = createServiceClient()
  const candidatos: CandidatoRetomada[] = []
  const pulados: PuladoRetomada[] = []
  for (const job of await jobsSemCredito(supabase, companyId, desde)) {
    const r = await montarCandidato(supabase, companyId, job)
    if ('motivo' in r) pulados.push(r)
    else candidatos.push(r)
  }
  return { candidatos, pulados }
}

/** Responde só as conversas aprovadas (lista explícita de ids), uma por vez. */
export async function executarRetomada(companyId: number, desde: string, conversasAprovadas: number[]) {
  const supabase = createServiceClient()
  const aprovadas = new Set(conversasAprovadas)
  const resultado: { conversationId: number; phone: string; status: string }[] = []

  for (const job of await jobsSemCredito(supabase, companyId, desde)) {
    const c = await montarCandidato(supabase, companyId, job)
    if ('motivo' in c || !aprovadas.has(c.conversationId)) continue

    // Reserva atômica: só um disparo consegue. Depois disso o job nunca mais entra em listagem nenhuma.
    const { data: reservado } = await supabase
      .from('sdr_jobs')
      .update({ status: 'RETOMADO', error: `${job.error} | retomado em ${new Date().toISOString()}` })
      .eq('id', job.id)
      .eq('status', 'COMPLETED')
      .select('id')
    if (!reservado?.length) {
      resultado.push({ conversationId: c.conversationId, phone: c.phone, status: 'pulado: já reservado por outro disparo' })
      continue
    }

    try {
      for (const m of c.mensagens) {
        const msg: BufferedMessage = {
          content: m.texto,
          type: m.tipo,
          timestamp: new Date().toISOString(),
          mediaUrl: m.mediaUrl,
          messageId: m.whatsappId ?? `retomada-${m.id}`,
          // A mensagem JÁ está no banco: synthetic faz o motor pular o saveInbound de vez (nem depende do id
          // bater), então é impossível aparecer cópia no painel.
          synthetic: true,
          retomada: true,
        }
        await bufferMessage(companyId, c.phone, msg, supabase)
      }
      await processSdrMessage(companyId, c.phone)
      resultado.push({ conversationId: c.conversationId, phone: c.phone, status: 'processado' })
    } catch (err: any) {
      resultado.push({ conversationId: c.conversationId, phone: c.phone, status: `erro: ${err?.message ?? err}` })
    }
  }
  return resultado
}
