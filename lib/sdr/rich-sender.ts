// Chokepoint único de envio pro canvas/follow-up : substitui as várias
// chamadas diretas a createUazapiClient espalhadas em follow.ts e
// follow-antnoshow.ts. Resolve o canal (Meta ou uazapi) por empresa a cada
// chamada — mesmo padrão que whatsapp-sender.ts já usa pro SDR em tempo real.
//
// Comportamento por canal/tipo:
//  - uazapi (canal atual, sem restrição de janela) : sendRichStep de sempre,
//    zero mudança de comportamento pra quem já usa uazapi hoje.
//  - Meta + lista/botões/carrossel : SEMPRE via Template HSM aprovado
//    (media.metaTemplateId, resolvido aqui contra hsm_templates), nunca
//    sujeito à janela de 24h — é a razão de template existir. Falta de
//    metaTemplateId ou template não aprovado é erro de autoria, lança.
//  - Meta + texto/mídia/localização : livre, mas checa a janela de 24h antes
//    de mandar (resolve a conversa pelo telefone). Fora da janela lança
//    WindowClosedError — os chamadores (follow.ts/follow-antnoshow.ts) já
//    têm try/catch + retry/DLQ em volta de todo envio, então isso vira só
//    mais um tipo de falha tratada pela máquina de retry existente, sem
//    precisar mudar nenhum dos ~20 call sites.
//  - Meta + sticker : não suportado (Meta exige webp pré-processado de um
//    jeito que não replicamos aqui), lança erro claro em vez de mandar
//    formato errado.

import { createServiceClient } from '@/lib/supabase/server'
import { createUazapiClient, sendRichStep, type StepTipoMensagem, type StepMediaConfig } from './uazapi'
import { getUazapiForCompany } from './uazapi-for-company'
import { getMetaConfig, sendText, sendMedia, sendLocation, sendTemplate } from './whatsapp-sender'
import { canSendFreeform } from './window'
import { getWindowStateForConversation } from './window-server'

export class WindowClosedError extends Error {
  constructor(companyId: number, phone: string) {
    super(`Fora da janela de 24h : companyId=${companyId} phone=${phone}`)
    this.name = 'WindowClosedError'
  }
}

// StepMediaConfig ganha esses campos opcionais só pro canal Meta (uazapi
// ignora) : id do Template HSM aprovado escolhido no canvas (Peça 5), e os
// valores das variáveis {{n}} do corpo, se o template tiver.
type RichMediaConfig = StepMediaConfig & { metaTemplateId?: string; metaTemplateBodyParams?: string[] }

async function resolveConversationId(supabase: ReturnType<typeof createServiceClient>, companyId: number, phone: string): Promise<number | null> {
  const { data } = await supabase
    .from('conversas_do_whatsapp')
    .select('id')
    .eq('company_id', companyId)
    .eq('numero_de_telefone', phone)
    .order('hora_da_ultima_mensagem', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data?.id ?? null
}

export async function sendRichStepUnified(
  companyId: number,
  phone: string,
  tipo: StepTipoMensagem,
  mensagem: string,
  media?: RichMediaConfig | null
): Promise<void> {
  const config = await getMetaConfig(companyId)
  const isMeta = config?.whatsapp_provider === 'meta' && !!config.meta_wa_phone_number_id && !!config.meta_wa_token

  if (!isMeta) {
    const uazapi = await getUazapiForCompany(companyId)
    // Simulação de digitação/gravação : comportamento idêntico ao que
    // enviarMensagem fazia antes de existir sendRichStepUnified.
    const typingMs = 2_000 + Math.floor(Math.random() * 3_000)
    const presenceType = tipo === 'audio' || tipo === 'ptt' ? 'recording' : 'composing'
    try {
      await uazapi.sendPresence(phone, presenceType, typingMs)
    } catch {
      // presence não-crítico : falha silenciosa, continua o envio
    }
    await new Promise((r) => setTimeout(r, typingMs))
    await sendRichStep(uazapi, phone, tipo, mensagem, media ?? undefined)
    return
  }

  // Meta : lista/botões/carrossel sempre via template, nunca checa janela
  if (tipo === 'menu' || tipo === 'carousel') {
    if (!media?.metaTemplateId) {
      throw new Error(`sendRichStepUnified: nó ${tipo} no canal Meta precisa de um Template HSM selecionado (media.metaTemplateId)`)
    }
    const supabase = createServiceClient()
    const { data: template } = await supabase
      .from('hsm_templates')
      .select('*')
      .eq('id', media.metaTemplateId)
      .eq('company_id', companyId)
      .maybeSingle()

    if (!template) throw new Error(`sendRichStepUnified: template ${media.metaTemplateId} não encontrado`)
    if (template.status !== 'aprovado') throw new Error(`sendRichStepUnified: template "${template.name}" ainda não foi aprovado pela Meta (status: ${template.status})`)

    const cards = template.kind === 'carousel'
      ? ((template.carousel_cards ?? []) as Array<{ header_type: 'image' | 'video'; media_url: string }>).map((c, i) => ({
          cardIndex: i,
          mediaType: c.header_type,
          mediaUrl: c.media_url,
        }))
      : undefined

    await sendTemplate({
      companyId,
      phoneNumber: phone,
      templateName: template.name,
      language: template.language,
      bodyParams: media.metaTemplateBodyParams,
      cards,
      fallbackText: mensagem,
    })
    return
  }

  if (tipo === 'sticker') {
    throw new Error('sendRichStepUnified: sticker não é suportado no canal Meta')
  }

  // Meta : texto/mídia/localização livres, respeitam a janela de 24h.
  const supabase = createServiceClient()
  const conversationId = await resolveConversationId(supabase, companyId, phone)
  if (conversationId != null) {
    const windowState = await getWindowStateForConversation(supabase, conversationId)
    if (windowState && !canSendFreeform(windowState)) {
      throw new WindowClosedError(companyId, phone)
    }
  }

  if (tipo === 'text') {
    await sendText({ companyId, phoneNumber: phone, text: mensagem })
    return
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
    return
  }

  if (tipo === 'location') {
    if (media?.latitude == null || media?.longitude == null) {
      throw new Error('sendRichStepUnified: location requer latitude e longitude')
    }
    await sendLocation({ companyId, phoneNumber: phone, latitude: media.latitude, longitude: media.longitude, name: media.name, address: media.address })
    return
  }

  // Tipos de controle de fluxo (agendamento/sentiment/goal/...) : mesmo
  // fallback que sendRichStep já usa pro uazapi, manda como texto simples.
  await sendText({ companyId, phoneNumber: phone, text: mensagem })
}

// Reexport pra quem só precisa do client uazapi direto (compat com código
// que ainda não foi migrado pra sendRichStepUnified)
export { createUazapiClient }
