import { createServiceClient } from '@/lib/supabase/server'
import { getUazapiForCompany } from './uazapi-for-company'
import { safeDecrypt } from '@/lib/crypto'
import { buildTemplateSendComponents, type SendButtonParam } from '@/lib/meta/hsm-components'

interface SendTextInput {
  companyId: number
  phoneNumber: string
  text: string
  replyId?: string
}

interface SendMediaInput {
  companyId: number
  phoneNumber: string
  type: 'image' | 'video' | 'document' | 'ptt'
  fileUrl: string
  caption?: string
  filename?: string
  replyId?: string
}

interface SendLocationInput {
  companyId: number
  phoneNumber: string
  latitude: number
  longitude: number
  name?: string
  address?: string
}

interface SendTemplateInput {
  companyId: number
  phoneNumber: string
  templateName: string
  language: string
  bodyParams?: string[]
  cards?: Array<{ cardIndex: number; mediaUrl: string; mediaType: 'image' | 'video'; buttons?: SendButtonParam[] }>
  // Usado só no envio via uazapi : esse canal não tem conceito de template
  // (sem restrição de janela nenhuma), manda o corpo já com variáveis
  // substituídas como mensagem de texto livre normal.
  fallbackText: string
  replyId?: string
}

interface SendResult {
  id?: string
}

export async function getMetaConfig(companyId: number) {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('sdr_configs')
    .select('whatsapp_provider, meta_wa_phone_number_id, meta_wa_token')
    .eq('company_id', companyId)
    .single()
  if (!data) return data
  return { ...data, meta_wa_token: data.meta_wa_token ? safeDecrypt(data.meta_wa_token) : data.meta_wa_token }
}

async function metaSendText(phoneNumberId: string, token: string, to: string, text: string, replyId?: string): Promise<SendResult> {
  const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: to.replace(/\D/g, ''),
      type: 'text',
      text: { body: text, preview_url: true },
      ...(replyId ? { context: { message_id: replyId } } : {}),
    }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json?.error?.message ?? `Meta API error ${res.status}`)
  return { id: json.messages?.[0]?.id }
}

async function metaSendMedia(phoneNumberId: string, token: string, to: string, type: string, fileUrl: string, caption?: string, filename?: string, replyId?: string): Promise<SendResult> {
  const mediaType = type === 'ptt' ? 'audio' : type
  const mediaObj: any = { link: fileUrl }
  if (caption) mediaObj.caption = caption
  if (filename && type === 'document') mediaObj.filename = filename

  const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: to.replace(/\D/g, ''),
      type: mediaType,
      [mediaType]: mediaObj,
      ...(replyId ? { context: { message_id: replyId } } : {}),
    }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json?.error?.message ?? `Meta API error ${res.status}`)
  return { id: json.messages?.[0]?.id }
}

async function metaSendLocation(phoneNumberId: string, token: string, to: string, latitude: number, longitude: number, name?: string, address?: string): Promise<SendResult> {
  const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: to.replace(/\D/g, ''),
      type: 'location',
      location: { latitude, longitude, name, address },
    }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json?.error?.message ?? `Meta API error ${res.status}`)
  return { id: json.messages?.[0]?.id }
}

// Media Upload API padrão (POST /{phone-number-id}/media) : usada SÓ no
// envio de card de carrossel (a Meta reexige upload a cada envio, não
// reaproveita o handle de criação). Diferente da Resumable Upload API usada
// na criação do template (ver lib/sdr/meta-template-upload.ts).
async function metaUploadMedia(phoneNumberId: string, token: string, fileUrl: string): Promise<string> {
  const fileRes = await fetch(fileUrl)
  if (!fileRes.ok) throw new Error(`Falha ao baixar mídia : ${fileRes.status}`)
  const contentType = fileRes.headers.get('content-type') ?? 'application/octet-stream'
  const buffer = Buffer.from(await fileRes.arrayBuffer())
  const fileName = fileUrl.split('/').pop()?.split('?')[0] ?? 'upload.bin'

  const fd = new FormData()
  fd.append('messaging_product', 'whatsapp')
  fd.append('file', new Blob([new Uint8Array(buffer)], { type: contentType }), fileName)

  const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/media`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  })
  const json = await res.json()
  if (!res.ok || !json?.id) throw new Error(json?.error?.message ?? 'Falha ao subir mídia pra Meta')
  return json.id as string
}

async function metaSendTemplate(phoneNumberId: string, token: string, to: string, templateName: string, language: string, components: unknown[], replyId?: string): Promise<SendResult> {
  const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: to.replace(/\D/g, ''),
      type: 'template',
      template: { name: templateName, language: { code: language }, components },
      ...(replyId ? { context: { message_id: replyId } } : {}),
    }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json?.error?.message ?? `Meta API error ${res.status}`)
  return { id: json.messages?.[0]?.id }
}

export async function sendText(input: SendTextInput): Promise<SendResult> {
  const config = await getMetaConfig(input.companyId)

  if (config?.whatsapp_provider === 'meta' && config.meta_wa_phone_number_id && config.meta_wa_token) {
    return metaSendText(config.meta_wa_phone_number_id, config.meta_wa_token, input.phoneNumber, input.text, input.replyId)
  }

  const uazapi = await getUazapiForCompany(input.companyId)
  return uazapi.sendText({ number: input.phoneNumber, text: input.text, replyid: input.replyId })
}

export async function sendMedia(input: SendMediaInput): Promise<SendResult> {
  const config = await getMetaConfig(input.companyId)

  if (config?.whatsapp_provider === 'meta' && config.meta_wa_phone_number_id && config.meta_wa_token) {
    return metaSendMedia(config.meta_wa_phone_number_id, config.meta_wa_token, input.phoneNumber, input.type, input.fileUrl, input.caption, input.filename, input.replyId)
  }

  const uazapi = await getUazapiForCompany(input.companyId)
  return uazapi.sendMedia({
    number: input.phoneNumber,
    type: input.type,
    file: input.fileUrl,
    text: input.caption,
    docName: input.filename,
  })
}

export async function sendLocation(input: SendLocationInput): Promise<SendResult> {
  const config = await getMetaConfig(input.companyId)

  if (config?.whatsapp_provider === 'meta' && config.meta_wa_phone_number_id && config.meta_wa_token) {
    return metaSendLocation(config.meta_wa_phone_number_id, config.meta_wa_token, input.phoneNumber, input.latitude, input.longitude, input.name, input.address)
  }

  const uazapi = await getUazapiForCompany(input.companyId)
  return uazapi.sendLocation({
    number: input.phoneNumber,
    name: input.name ?? '',
    address: input.address ?? '',
    latitude: input.latitude,
    longitude: input.longitude,
  })
}

// Template HSM aprovado : único jeito de mandar lista/botões/carrossel no
// Meta, e único jeito de mandar qualquer coisa fora da janela de 24h. Na
// uazapi, que não tem esse conceito nem restrição de janela, manda o corpo
// já renderizado como texto livre normal — assimetria deliberada, não bug.
export async function sendTemplate(input: SendTemplateInput): Promise<SendResult> {
  const config = await getMetaConfig(input.companyId)

  if (config?.whatsapp_provider === 'meta' && config.meta_wa_phone_number_id && config.meta_wa_token) {
    const phoneNumberId = config.meta_wa_phone_number_id
    const token = config.meta_wa_token

    const cards = input.cards?.length
      ? await Promise.all(
          input.cards.map(async (c) => ({
            cardIndex: c.cardIndex,
            mediaType: c.mediaType,
            mediaId: await metaUploadMedia(phoneNumberId, token, c.mediaUrl),
            buttons: c.buttons,
          }))
        )
      : undefined

    const components = buildTemplateSendComponents({ bodyParams: input.bodyParams, cards })
    return metaSendTemplate(phoneNumberId, token, input.phoneNumber, input.templateName, input.language, components, input.replyId)
  }

  const uazapi = await getUazapiForCompany(input.companyId)
  return uazapi.sendText({ number: input.phoneNumber, text: input.fallbackText, replyid: input.replyId })
}
