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

// Janela de sincronização: 45 dias, todo ciclo. O upsert (onConflict company_id,ad_id,date) reescreve os dias
// com o valor mais atual da Meta, então o dado de hoje fica fresco e dias que ficaram de fora (conta conectada
// depois do início das campanhas, cron parado) são preenchidos sozinhos. Antes eram só 3 dias, e o gasto e as
// conversas de 01 e 02/09 nunca entraram (Rodrigo, 2026-09-25: Gerenciador R$ 2.151 x Zaapply R$ 1.962).
const JANELA_DIAS = 45
const MAX_PAGINAS = 20

function janelaRolante(dias = JANELA_DIAS): { since: string; until: string } {
  const hoje = new Date()
  const inicio = new Date(hoje)
  inicio.setDate(inicio.getDate() - (dias - 1))
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  return { since: fmt(inicio), until: fmt(hoje) }
}

async function fetchAdAccountInsights(adAccountId: string, token: string): Promise<MetaInsightRow[]> {
  const fields = 'spend,impressions,clicks,campaign_id,campaign_name,ad_id,ad_name,actions'
  const { since, until } = janelaRolante()
  const timeRange = encodeURIComponent(JSON.stringify({ since, until }))
  let url: string | null = `https://graph.facebook.com/v21.0/act_${adAccountId}/insights?level=ad&fields=${fields}&time_range=${timeRange}&time_increment=1&limit=500`
  const all: MetaInsightRow[] = []
  for (let page = 0; url && page < MAX_PAGINAS; page++) {
    const res: Response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    const json = await res.json()
    if (!res.ok) throw new Error(json?.error?.message ?? `Meta insights falhou (status ${res.status})`)
    all.push(...((json.data ?? []) as MetaInsightRow[]))
    url = json?.paging?.next ?? null
  }
  return all
}

async function syncCompany(companyId: number, adAccountId: string, token: string, supabase: Supabase): Promise<number> {
  const rows = await fetchAdAccountInsights(adAccountId, token)
  const fetchedAt = new Date().toISOString()
  const records = rows
    .filter((row) => row.ad_id && row.date_start)
    .map((row) => ({
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
      fetched_at: fetchedAt,
    }))
  let synced = 0
  for (let i = 0; i < records.length; i += 200) {
    const chunk = records.slice(i, i + 200)
    const { error } = await supabase.from('meta_ad_insights').upsert(chunk, { onConflict: 'company_id,ad_id,date' })
    if (!error) synced += chunk.length
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
