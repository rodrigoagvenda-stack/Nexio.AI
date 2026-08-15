import { createServiceClient } from '@/lib/supabase/server'
import { getUazapiForCompany } from './uazapi-for-company'

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

interface SendResult {
  id?: string
}

async function getMetaConfig(companyId: number) {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('sdr_configs')
    .select('whatsapp_provider, meta_wa_phone_number_id, meta_wa_token')
    .eq('company_id', companyId)
    .single()
  return data
}

async function metaSendText(phoneNumberId: string, token: string, to: string, text: string, replyId?: string): Promise<SendResult> {
  const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: to.replace(/\D/g, ''),
      type: 'text',
      text: { body: text },
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
