/**
 * Cliente GTPRO — proxy para Meta Ads (CAPI + Marketing API)
 * Usa a API Key da empresa armazenada em sdr_configs.gtpro_api_key
 */

const GTPRO_BASE = process.env.GTPRO_API_URL ?? 'https://api.vendai.pro'

export interface GtproLeadPayload {
  name?: string
  phone?: string
  email?: string
  fbclid?: string        // ctwa_clid do referral
  utm_source?: string
  utm_campaign?: string  // ad_id do referral
  metadata?: Record<string, unknown>
}

export interface GtproConvertPayload {
  value?: number
}

async function gtproPost(path: string, apiKey: string, body: unknown): Promise<{ id?: string } | null> {
  try {
    const res = await fetch(`${GTPRO_BASE}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      console.warn(`[gtpro] ${path} → ${res.status}`)
      return null
    }
    return res.json()
  } catch (err: any) {
    console.error(`[gtpro] ${path} falhou:`, err.message)
    return null
  }
}

/** Cria lead no GTPRO e retorna o ID gerado */
export async function gtproCreateLead(apiKey: string, payload: GtproLeadPayload): Promise<string | null> {
  const data = await gtproPost('/api/webhook/leads', apiKey, payload)
  return (data as any)?.lead?.id ?? (data as any)?.id ?? null
}

/** Dispara evento de conversão (CAPI Purchase) no GTPRO */
export async function gtproConvertLead(apiKey: string, gtproLeadId: string, payload: GtproConvertPayload): Promise<boolean> {
  const data = await gtproPost(`/api/leads/${gtproLeadId}/convert`, apiKey, payload)
  return data !== null
}
