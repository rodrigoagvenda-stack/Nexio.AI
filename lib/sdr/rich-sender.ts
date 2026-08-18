// Chokepoint único de envio pro canvas/follow-up : substitui as várias
// chamadas diretas a createUazapiClient espalhadas em follow.ts e
// follow-antnoshow.ts. Resolve o canal (Meta ou uazapi) por empresa a cada
// chamada — mesmo padrão que whatsapp-sender.ts já usa pro SDR em tempo real.
//
// Comportamento por canal/tipo:
//  - uazapi (canal atual, sem restrição de janela) : sendRichStep de sempre,
//    zero mudança de comportamento pra quem já usa uazapi hoje.
//  - Meta + lista/botões/carrossel : SEMPRE via Template HSM aprovado
//    (media.metaTemplate), nunca sujeito à janela de 24h — é a razão de
//    template existir. Falta de metaTemplate é erro de autoria, lança.
//  - Meta + texto/mídia/localização : livre, mas checa a janela de 24h antes
//    de mandar (só quando conversationId é passado). Fora da janela retorna
//    bloqueado (não lança) pra quem chamou decidir loggar/pular.
//  - Meta + sticker : não suportado (Meta exige webp pré-processado de um
//    jeito que não replicamos aqui), lança erro claro em vez de mandar
//    formato errado.

import { createServiceClient } from '@/lib/supabase/server'
import { createUazapiClient, sendRichStep, type StepTipoMensagem, type StepMediaConfig } from './uazapi'
import { getUazapiForCompany } from './uazapi-for-company'
import { getMetaConfig, sendText, sendMedia, sendLocation, sendTemplate } from './whatsapp-sender'
import { canSendFreeform } from './window'
import { getWindowStateForConversation } from './window-server'

export interface RichSendResult {
  sent: boolean
  reason?: 'window_closed'
}

interface MetaTemplateRef {
  templateName: string
  language: string
  bodyParams?: string[]
  cards?: Array<{ cardIndex: number; mediaUrl: string; mediaType: 'image' | 'video'; buttons?: Array<{ subType: 'quick_reply' | 'url'; index: number; value: string }> }>
}

// StepMediaConfig ganha esse campo opcional só pro canal Meta (uazapi ignora)
type RichMediaConfig = StepMediaConfig & { metaTemplate?: MetaTemplateRef }

export async function sendRichStepUnified(
  companyId: number,
  phone: string,
  tipo: StepTipoMensagem,
  mensagem: string,
  media?: RichMediaConfig | null,
  conversationId?: string | number
): Promise<RichSendResult> {
  const config = await getMetaConfig(companyId)
  const isMeta = config?.whatsapp_provider === 'meta' && !!config.meta_wa_phone_number_id && !!config.meta_wa_token

  if (!isMeta) {
    const uazapi = await getUazapiForCompany(companyId)
    await sendRichStep(uazapi, phone, tipo, mensagem, media ?? undefined)
    return { sent: true }
  }

  // Meta : lista/botões/carrossel sempre via template, nunca checa janela
  if (tipo === 'menu' || tipo === 'carousel') {
    if (!media?.metaTemplate) {
      throw new Error(`sendRichStepUnified: nó ${tipo} no canal Meta precisa de um Template HSM selecionado (media.metaTemplate)`)
    }
    const t = media.metaTemplate
    await sendTemplate({
      companyId,
      phoneNumber: phone,
      templateName: t.templateName,
      language: t.language,
      bodyParams: t.bodyParams,
      cards: t.cards,
      fallbackText: mensagem,
    })
    return { sent: true }
  }

  if (tipo === 'sticker') {
    throw new Error('sendRichStepUnified: sticker não é suportado no canal Meta')
  }

  // Meta : texto/mídia/localização livres, respeitam a janela de 24h quando
  // a chamada informa uma conversa existente pra checar.
  if (conversationId != null) {
    const supabase = createServiceClient()
    const windowState = await getWindowStateForConversation(supabase, conversationId)
    if (windowState && !canSendFreeform(windowState)) {
      return { sent: false, reason: 'window_closed' }
    }
  }

  if (tipo === 'text') {
    await sendText({ companyId, phoneNumber: phone, text: mensagem })
    return { sent: true }
  }

  if (tipo === 'image' || tipo === 'video' || tipo === 'document' || tipo === 'audio' || tipo === 'ptt') {
    if (!media?.file) throw new Error(`sendRichStepUnified: tipo ${tipo} requer media.file`)
    await sendMedia({
      companyId,
      phoneNumber: phone,
      type: tipo === 'audio' ? 'ptt' : tipo,
      fileUrl: media.file,
      caption: media.text,
      filename: media.docName,
    })
    return { sent: true }
  }

  if (tipo === 'location') {
    if (media?.latitude == null || media?.longitude == null) {
      throw new Error('sendRichStepUnified: location requer latitude e longitude')
    }
    await sendLocation({ companyId, phoneNumber: phone, latitude: media.latitude, longitude: media.longitude, name: media.name, address: media.address })
    return { sent: true }
  }

  // Tipos de controle de fluxo (agendamento/sentiment/goal/...) : mesmo
  // fallback que sendRichStep já usa pro uazapi, manda como texto simples.
  await sendText({ companyId, phoneNumber: phone, text: mensagem })
  return { sent: true }
}

// Reexport pra quem só precisa do client uazapi direto (compat com código
// que ainda não foi migrado pra sendRichStepUnified)
export { createUazapiClient }
