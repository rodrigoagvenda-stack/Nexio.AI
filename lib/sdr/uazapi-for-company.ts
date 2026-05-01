import { createServiceClient } from '@/lib/supabase/server'
import { createUazapiClient, UazapiClient } from './uazapi'

/** Retorna UazapiClient configurado para a empresa, lendo sdr_configs. */
export async function getUazapiForCompany(companyId: number): Promise<UazapiClient> {
  const service = createServiceClient()
  const { data } = await service
    .from('sdr_configs')
    .select('uazapi_instance_url, uazapi_token')
    .eq('company_id', companyId)
    .single()

  if (!data?.uazapi_token) throw new Error('Instância WhatsApp não configurada para esta empresa')

  let token = data.uazapi_token
  if (token.includes(':') && token.split(':').length === 3) {
    try { const { decrypt } = await import('@/lib/crypto'); token = decrypt(token) } catch {}
  }

  const baseUrl = (data.uazapi_instance_url || 'https://nexioai.uazapi.com').replace(/\/$/, '')
  return createUazapiClient(baseUrl, token)
}

/** Formata número para JID WhatsApp (ex: 5511999999999 → 5511999999999@s.whatsapp.net) */
export function toJid(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return digits.includes('@') ? digits : `${digits}@s.whatsapp.net`
}
