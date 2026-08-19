/**
 * Ingestão unificada de webhook de WhatsApp : encanamento compartilhado entre
 * os canais uazapi e Meta/CoEx. A única diferença entre os dois deve ser qual
 * API fala com o WhatsApp — tudo daqui pra baixo (conversa, lead, atribuição,
 * mensagem, buffer, job) se comporta de forma idêntica nos dois canais.
 *
 * NÃO mexe em nada do fluxo imutável do SDR (processSdrMessage, orquestrador,
 * tools, prompts) — isso continua 100% em engine.ts, intocado.
 */

import { createServiceClient } from '@/lib/supabase/server'
import { bufferMessage, findOrCreateLead, type BufferedMessage } from './engine'
import { computeLeadScore } from './lead-score'

type Supabase = ReturnType<typeof createServiceClient>

export interface NormalizedReferral {
  ctwaClid?: string | null
  gclid?: string | null
  sourceId?: string | null
  sourceUrl?: string | null
  sourceType?: string | null
  headline?: string | null
  body?: string | null
}

export interface NormalizedInboundEvent {
  companyId: number
  channel: 'uazapi' | 'meta'
  phone: string
  messageId: string
  type: string
  text: string
  timestamp: string
  senderName?: string
  senderPhoto?: string
  mediaUrl?: string
  referral?: NormalizedReferral | null
  instanceName?: string | null
}

export interface IngestResult {
  handled: boolean
  conversationId: string | null
  leadId: number | null
}

async function resolveInboxModeForCompany(companyId: number, supabase: Supabase): Promise<'vendas' | 'suporte'> {
  const { data: flows } = await supabase
    .from('sdr_flows')
    .select('inbox_mode')
    .eq('company_id', companyId)
    .eq('ativo', true)
    .in('tipo', ['inbound', 'ambos'])
    .limit(1)
  return (flows?.[0]?.inbox_mode as 'vendas' | 'suporte') ?? 'suporte'
}

interface EnsureConversationParams {
  companyId: number
  phone: string
  leadId: number
  contactName: string
  displayText: string
  instanceName?: string | null
  referral?: NormalizedReferral | null
}

interface EnsureConversationResult {
  conversationId: string
  isNewConversation: boolean
  mensagensRecebidas: number
  kanbanStage: string | null
}

// Cria/atualiza a conversa no momento do webhook (mesmo timing que a Meta já
// usava) : garante contagem_nao_lida, atribuição CTWA e id_do_lead corretos
// pros dois canais, e visibilidade imediata no Atendimento.
async function ensureConversationAtWebhookTime(
  params: EnsureConversationParams,
  supabase: Supabase
): Promise<EnsureConversationResult> {
  const { companyId, phone, leadId, contactName, displayText, instanceName, referral } = params
  const ctwaClid = referral?.ctwaClid ?? null
  const gclid = referral?.gclid ?? null
  const ts = new Date().toISOString()

  const { data: existing } = await supabase
    .from('conversas_do_whatsapp')
    .select('id, contagem_nao_lida, ctwa_clid, gclid, mensagens_recebidas, kanban_stage')
    .eq('company_id', companyId)
    .eq('numero_de_telefone', phone)
    .maybeSingle()

  if (existing?.id) {
    const mensagensRecebidas = (existing.mensagens_recebidas ?? 0) + 1
    const updatePayload: Record<string, unknown> = {
      ultima_mensagem: displayText,
      hora_da_ultima_mensagem: ts,
      contagem_nao_lida: (existing.contagem_nao_lida ?? 0) + 1,
      ultima_mensagem_inbound_at: ts,
      mensagens_recebidas: mensagensRecebidas,
    }
    // Primeira atribuição ganha : só sobrescreve se ainda não tinha ctwa_clid
    if (ctwaClid && !existing.ctwa_clid) {
      updatePayload.ctwa_clid = ctwaClid
      updatePayload.attribution_source = 'meta_ctwa'
      updatePayload.window_type = 'ctwa'
      updatePayload.window_expires_at = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()
    }
    if (gclid && !existing.gclid) {
      updatePayload.gclid = gclid
      if (!ctwaClid && !existing.ctwa_clid) updatePayload.attribution_source = 'google_ads'
    }
    if (instanceName) updatePayload.instance_name = instanceName

    await supabase.from('conversas_do_whatsapp').update(updatePayload).eq('id', existing.id)
    return {
      conversationId: String(existing.id),
      isNewConversation: false,
      mensagensRecebidas,
      kanbanStage: existing.kanban_stage ?? null,
    }
  }

  const inboxMode = await resolveInboxModeForCompany(companyId, supabase)
  const windowExpiresAt = ctwaClid
    ? new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()
    : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

  const { data: created, error } = await supabase
    .from('conversas_do_whatsapp')
    .insert({
      company_id: companyId,
      id_do_lead: leadId,
      numero_de_telefone: phone,
      nome_do_contato: contactName,
      ultima_mensagem: displayText,
      hora_da_ultima_mensagem: ts,
      status_da_conversa: 'aberto',
      contagem_nao_lida: 1,
      ultima_mensagem_inbound_at: ts,
      mensagens_recebidas: 1,
      ctwa_clid: ctwaClid,
      gclid,
      attribution_source: ctwaClid ? 'meta_ctwa' : gclid ? 'google_ads' : 'organic',
      window_type: ctwaClid ? 'ctwa' : 'regular',
      window_expires_at: windowExpiresAt,
    })
    .select('id')
    .single()

  if (error || !created?.id) {
    throw new Error(`ensureConversationAtWebhookTime : falha ao criar conversa : ${error?.message ?? 'id nulo'}`)
  }

  if (instanceName) {
    supabase.from('conversas_do_whatsapp').update({ instance_name: instanceName }).eq('id', created.id)
      .then(() => {}, () => {})
  }

  // Round-robin auto-assign pra modo 'vendas' : réplica exata do bloco que
  // hoje só roda dentro do ensureConversation() (job-time). Como a conversa
  // passa a ser criada aqui, aquele bloco nunca mais chegaria a rodar.
  if (inboxMode === 'vendas') {
    try {
      const { data: attendants } = await supabase
        .from('users')
        .select('id')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .in('role', ['sdr', 'closer', 'sdr_closer', 'manager', 'admin'])

      if (attendants && attendants.length > 0) {
        const { data: loads } = await supabase
          .from('conversas_do_whatsapp')
          .select('assigned_to')
          .eq('company_id', companyId)
          .eq('status_da_conversa', 'aberto')
          .not('assigned_to', 'is', null)

        const countMap: Record<number, number> = {}
        for (const a of attendants) countMap[a.id] = 0
        for (const c of (loads ?? [])) {
          if (c.assigned_to != null && countMap[c.assigned_to] !== undefined) {
            countMap[c.assigned_to]++
          }
        }

        const nextUser = attendants.reduce((min, a) =>
          (countMap[a.id] ?? 0) < (countMap[min.id] ?? 0) ? a : min
        )

        await supabase
          .from('conversas_do_whatsapp')
          .update({ assigned_to: nextUser.id, assigned_at: new Date().toISOString() })
          .eq('id', created.id)
      }
    } catch (err: any) {
      console.error(`[inbound:${companyId}] round-robin assign error:`, err.message)
    }
  }

  return { conversationId: String(created.id), isNewConversation: true, mensagensRecebidas: 1, kanbanStage: 'novo' }
}

// Casa a mensagem que chega com um clique recente numa landing de captura de
// gclid (app/l/[slug]) pelo telefone informado lá. Consome o clique (marca
// consumed_at) pra não reaproveitar o mesmo gclid numa conversa futura.
async function resolveGclidForPhone(companyId: number, phone: string, supabase: Supabase): Promise<string | null> {
  const { data: click } = await supabase
    .from('tracking_link_clicks')
    .select('id, gclid')
    .eq('company_id', companyId)
    .eq('captured_phone', phone)
    .is('consumed_at', null)
    .order('clicked_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!click?.gclid) return null

  await supabase.from('tracking_link_clicks').update({ consumed_at: new Date().toISOString() }).eq('id', click.id)
  return click.gclid
}

async function insertAttributionEvent(
  conversationId: string,
  referral: NormalizedReferral | null | undefined,
  supabase: Supabase
): Promise<void> {
  const ctwaClid = referral?.ctwaClid ?? null
  const attrSource = ctwaClid ? 'meta_ctwa' : referral?.gclid ? 'google_ads' : 'organic'
  const windowType = ctwaClid ? 'meta_ctwa_72h' : 'organic_free'
  await supabase.from('attribution_events').insert({
    conversation_id: conversationId,
    source: attrSource,
    ctwa_clid: ctwaClid,
    gclid: referral?.gclid ?? null,
    campaign_id: referral?.sourceId ?? null,
    referral_source_url: referral?.sourceUrl ?? null,
    referral_source_type: referral?.sourceType ?? null,
    referral_headline: referral?.headline ?? null,
    referral_body: referral?.body ?? null,
    window_type: windowType,
  })
}

// Peça E: recalcula o lead_score a cada mensagem inbound, usando o que já
// foi resolvido nesta mesma ingestão (profundidade, estágio) + duas buscas
// leves (nível de interesse do lead, timestamp da última resposta nossa).
export async function recomputeAndStoreLeadScore(
  params: { companyId: number; conversationId: string; leadId: number; mensagensRecebidas: number; kanbanStage: string | null; currentInboundAt: string },
  supabase: Supabase
): Promise<void> {
  const [{ data: leadRow }, { data: lastOutbound }] = await Promise.all([
    supabase.from('leads').select('nivel_interesse').eq('id', params.leadId).maybeSingle(),
    supabase
      .from('mensagens_do_whatsapp')
      .select('carimbo_de_data_e_hora')
      .eq('id_da_conversacao', params.conversationId)
      .eq('direcao', 'outbound')
      .order('carimbo_de_data_e_hora', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const score = computeLeadScore({
    mensagensRecebidas: params.mensagensRecebidas,
    lastOutboundAt: lastOutbound?.carimbo_de_data_e_hora ?? null,
    currentInboundAt: params.currentInboundAt,
    kanbanStage: params.kanbanStage,
    nivelInteresse: leadRow?.nivel_interesse ?? null,
  })

  await supabase
    .from('conversas_do_whatsapp')
    .update({ lead_score: score, lead_score_updated_at: new Date().toISOString() })
    .eq('id', params.conversationId)
}

async function insertInboundMessageRow(
  params: {
    companyId: number
    conversationId: string
    leadId: number
    text: string
    type: string
    mediaUrl?: string
    messageId: string
    timestamp: string
  },
  supabase: Supabase
): Promise<void> {
  const { data: alreadySaved } = await supabase
    .from('mensagens_do_whatsapp')
    .select('id')
    .eq('whatsapp_message_id', params.messageId)
    .maybeSingle()

  if (alreadySaved) return

  await supabase.from('mensagens_do_whatsapp').insert({
    company_id: params.companyId,
    id_da_conversacao: params.conversationId,
    id_do_lead: params.leadId,
    texto_da_mensagem: params.text,
    tipo_de_mensagem: params.type,
    direcao: 'inbound',
    sender_type: 'human',
    carimbo_de_data_e_hora: params.timestamp,
    url_da_midia: params.mediaUrl ?? null,
    whatsapp_message_id: params.messageId,
  })
}

export async function upsertSdrJob(companyId: number, phone: string, supabase: Supabase): Promise<void> {
  const { error } = await supabase.from('sdr_jobs').upsert(
    {
      company_id: companyId,
      phone,
      status: 'PENDING',
      last_message_at: new Date().toISOString(),
      attempts: 0,
    },
    { onConflict: 'company_id,phone', ignoreDuplicates: false }
  )
  if (error) console.error(`[inbound:${companyId}] ERRO ao criar job:`, error.message)
}

export async function ingestInboundMessage(evt: NormalizedInboundEvent, supabase: Supabase): Promise<IngestResult> {
  // Dedup por messageId : se já está no buffer, essa entrega é redundante
  const { data: dup } = await supabase
    .from('sdr_message_buffer')
    .select('messages')
    .eq('company_id', evt.companyId)
    .eq('phone', evt.phone)
    .maybeSingle()

  if (dup?.messages) {
    const msgs = dup.messages as BufferedMessage[]
    if (msgs.some((m) => m.messageId === evt.messageId)) {
      return { handled: false, conversationId: null, leadId: null }
    }
  }

  let conversationId: string | null = null
  let leadId: number | null = null

  // Lead/conversa/atribuição/mensagem são enriquecimento pra UI (Atendimento) :
  // se falhar, não pode impedir o buffer+job de rodar, que é o que garante
  // que o SDR responde. ensureConversation() no job-time continua existindo
  // como rede de segurança.
  try {
    const { data: company } = await supabase.from('companies').select('name').eq('id', evt.companyId).single()
    const lead = await findOrCreateLead(evt.companyId, evt.phone, evt.senderName ?? '', company?.name ?? '', supabase)
    leadId = lead.id

    // Referral da Meta (CTWA) nunca traz gclid : busca separada por clique de
    // Google Ads capturado na landing app/l/[slug] antes dessa mensagem chegar.
    let referral = evt.referral ?? null
    if (!referral?.gclid) {
      const matchedGclid = await resolveGclidForPhone(evt.companyId, evt.phone, supabase)
      if (matchedGclid) referral = { ...(referral ?? {}), gclid: matchedGclid }
    }

    const { conversationId: convId, isNewConversation, mensagensRecebidas, kanbanStage } = await ensureConversationAtWebhookTime(
      {
        companyId: evt.companyId,
        phone: evt.phone,
        leadId,
        contactName: evt.senderName || evt.phone,
        displayText: evt.text,
        instanceName: evt.instanceName,
        referral,
      },
      supabase
    )
    conversationId = convId

    if (isNewConversation) {
      await insertAttributionEvent(conversationId, referral, supabase)
    }

    await recomputeAndStoreLeadScore(
      { companyId: evt.companyId, conversationId, leadId, mensagensRecebidas, kanbanStage, currentInboundAt: evt.timestamp },
      supabase
    )

    await insertInboundMessageRow(
      {
        companyId: evt.companyId,
        conversationId,
        leadId,
        text: evt.text,
        type: evt.type,
        mediaUrl: evt.mediaUrl,
        messageId: evt.messageId,
        timestamp: evt.timestamp,
      },
      supabase
    )
  } catch (e: any) {
    console.error(`[inbound:${evt.companyId}] falha ao gravar conversa/lead/mensagem (buffer/job seguem normalmente):`, e.message)
  }

  const bufferedMsg: BufferedMessage = {
    content: evt.text,
    type: evt.type,
    timestamp: evt.timestamp,
    messageId: evt.messageId,
    mediaUrl: evt.mediaUrl,
    senderName: evt.senderName,
    senderPhoto: evt.senderPhoto,
  }
  await bufferMessage(evt.companyId, evt.phone, bufferedMsg, supabase)
  await upsertSdrJob(evt.companyId, evt.phone, supabase)

  return { handled: true, conversationId, leadId }
}
