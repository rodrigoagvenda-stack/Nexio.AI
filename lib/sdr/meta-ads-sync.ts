// Peça B do plano "máquina de vendas completa": sincroniza gasto por anúncio
// da Marketing API pra dentro de meta_ad_insights. V1 só processa
// spend/impressions/clicks (campos estáveis e documentados) -- os campos de
// "conversas iniciadas"/profundidade que a Meta devolve em 'actions' não têm
// nome documentado, ficam só no 'raw' pra inspeção manual antes de virar
// parsing definitivo (ver Achados no plano). O CAC (Peça B-3) não depende
// disso : usa a conversão real do nosso lado (conversion_values), não o que
// a Meta relata sobre si mesma.
import { createServiceClient } from '@/lib/supabase/server'
import { safeDecrypt } from '@/lib/crypto'

type Supabase = ReturnType<typeof createServiceClient>

interface MetaInsightRow {
  ad_id?: string
  ad_name?: string
  campaign_id?: string
  campaign_name?: string
  date_start?: string
  spend?: string
  impressions?: string
  clicks?: string
  actions?: unknown
}

async function fetchAdAccountInsights(adAccountId: string, token: string): Promise<MetaInsightRow[]> {
  const fields = 'spend,impressions,clicks,campaign_id,campaign_name,ad_id,ad_name,actions'
  const url = `https://graph.facebook.com/v21.0/act_${adAccountId}/insights?level=ad&fields=${fields}&date_preset=yesterday&time_increment=1&limit=500`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  const json = await res.json()
  if (!res.ok) throw new Error(json?.error?.message ?? `Meta insights falhou (status ${res.status})`)
  return (json.data ?? []) as MetaInsightRow[]
}

async function syncCompany(companyId: number, adAccountId: string, token: string, supabase: Supabase): Promise<number> {
  const rows = await fetchAdAccountInsights(adAccountId, token)
  let synced = 0
  for (const row of rows) {
    if (!row.ad_id || !row.date_start) continue
    const { error } = await supabase.from('meta_ad_insights').upsert(
      {
        company_id: companyId,
        ad_id: row.ad_id,
        ad_name: row.ad_name ?? null,
        campaign_id: row.campaign_id ?? null,
        campaign_name: row.campaign_name ?? null,
        date: row.date_start,
        spend_cents: Math.round(Number(row.spend ?? 0) * 100),
        impressions: Number(row.impressions ?? 0),
        clicks: Number(row.clicks ?? 0),
        raw: row.actions ?? null,
        fetched_at: new Date().toISOString(),
      },
      { onConflict: 'company_id,ad_id,date' }
    )
    if (!error) synced++
  }
  return synced
}

export async function runMetaAdsSync(): Promise<{ companies: number; synced: number; errors: string[] }> {
  const supabase = createServiceClient()
  const errors: string[] = []
  let synced = 0
  let companiesProcessed = 0

  const { data: configs } = await supabase
    .from('sdr_configs')
    .select('company_id, meta_access_token, meta_ad_account_id')
    .not('meta_access_token', 'is', null)
    .not('meta_ad_account_id', 'is', null)

  for (const cfg of configs ?? []) {
    try {
      const token = safeDecrypt(cfg.meta_access_token)
      if (!token || !cfg.meta_ad_account_id) continue
      synced += await syncCompany(cfg.company_id, cfg.meta_ad_account_id, token, supabase)
      companiesProcessed++
    } catch (err: any) {
      errors.push(`company=${cfg.company_id}: ${err.message}`)
    }
  }

  return { companies: companiesProcessed, synced, errors }
}
