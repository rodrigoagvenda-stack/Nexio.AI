import crypto from 'crypto'
import { createServiceClient } from '@/lib/supabase/server'
import { safeDecrypt } from '@/lib/crypto'

type Supabase = ReturnType<typeof createServiceClient>

export interface FireCapiParams {
  companyId: number
  phone: string
  eventName?: string
  valueCents?: number | null
  currency?: string
  eventIdSeed: string
}

export interface FireCapiResult {
  ok: boolean
  skipped?: string
  error?: string
}

/**
 * Único ponto de disparo de evento de conversão pra Meta Conversions API.
 * Manda o evento sempre que houver telefone (com ou sem ctwa_clid) : não
 * inventa o clid quando não existe, mas também não deixa de mandar o
 * evento por falta dele — é a prática padrão de mercado (ver commit).
 */
export async function fireMetaCapiEvent(supabase: Supabase, params: FireCapiParams): Promise<FireCapiResult> {
  const { companyId, phone, eventName = 'Purchase', valueCents, currency = 'BRL', eventIdSeed } = params

  const { data: config } = await supabase
    .from('sdr_configs')
    .select('meta_pixel_id, meta_pixel_token, meta_capi_waba_id, meta_wa_waba_id')
    .eq('company_id', companyId)
    .maybeSingle()

  if (!config?.meta_pixel_id || !config?.meta_pixel_token) {
    return { ok: false, skipped: 'Pixel não configurado' }
  }

  const pixelToken = safeDecrypt(config.meta_pixel_token)
  // Eventos business_messaging exigem a conta do WhatsApp Business no user_data. Número da API oficial usa
  // meta_wa_waba_id; número fora dela (uazapi) usa o ID informado em Conexões > Pixel.
  const wabaId = (config.meta_capi_waba_id || config.meta_wa_waba_id || '').toString().trim()
  const normalizedPhone = phone.replace(/\D/g, '')

  // Busca a conversa vinculada (mesmo join usado na fusão do Kanban) : é
  // dali que vem o ctwa_clid, quando existir.
  const { data: conversa } = await supabase
    .from('conversas_do_whatsapp')
    .select('id, ctwa_clid')
    .eq('company_id', companyId)
    .eq('numero_de_telefone', normalizedPhone)
    .maybeSingle()

  const phoneHash = normalizedPhone ? crypto.createHash('sha256').update(normalizedPhone).digest('hex') : undefined
  const eventTime = Math.floor(Date.now() / 1000)

  const payload = {
    data: [{
      event_name: eventName,
      event_time: eventTime,
      event_id: `zaapply_${eventIdSeed}_${eventTime}`,
      action_source: 'business_messaging',
      messaging_channel: 'whatsapp',
      user_data: {
        ...(wabaId ? { whatsapp_business_account_id: wabaId } : {}),
        ...(phoneHash ? { ph: [phoneHash] } : {}),
        ...(conversa?.ctwa_clid ? { ctwa_clid: conversa.ctwa_clid } : {}),
      },
      ...(valueCents !== undefined && valueCents !== null ? { custom_data: { value: valueCents / 100, currency } } : {}),
    }],
  }

  let responseStatus: number | undefined
  let responseBody: unknown
  let success = false
  let errorMessage: string | undefined

  if (!wabaId) {
    // Sem o ID a Meta recusa o evento (erro 2804116). Não envia, mas registra o motivo para aparecer na tela.
    errorMessage = 'Falta o ID da conta do WhatsApp Business. Informe em Conexões > Pixel da Meta.'
    if (conversa?.id) {
      await supabase.from('conversions_api_log').insert({
        conversation_id: conversa.id,
        payload_sent: payload,
        response_status: null,
        response_body: { error: { error_user_msg: errorMessage } },
        success: false,
      })
    }
    console.error(`[CAPI] não enviado : companyId=${companyId} eventName=${eventName} error=${errorMessage}`)
    return { ok: false, skipped: errorMessage }
  }

  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${config.meta_pixel_id}/events?access_token=${pixelToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    responseStatus = res.status
    responseBody = await res.json().catch(() => null)
    success = res.ok
    if (!res.ok) errorMessage = (responseBody as any)?.error?.message ?? `Meta CAPI error ${res.status}`
  } catch (e: any) {
    errorMessage = e.message
  }

  // Auditoria : só grava se tiver uma conversa real pra referenciar (FK NOT NULL)
  if (conversa?.id) {
    await supabase.from('conversions_api_log').insert({
      conversation_id: conversa.id,
      payload_sent: payload,
      response_status: responseStatus ?? null,
      response_body: responseBody ?? null,
      success,
    })
  }

  if (!success) {
    console.error(`[CAPI] falha : companyId=${companyId} eventName=${eventName} error=${errorMessage}`)
    return { ok: false, error: errorMessage }
  }

  console.log(`[CAPI] evento ${eventName} enviado : companyId=${companyId} pixel=${config.meta_pixel_id} ctwa=${conversa?.ctwa_clid ? 'SIM' : 'NAO'}`)
  return { ok: true }
}
