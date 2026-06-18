export interface MetaCreative {
  headline: string
  leads: number
  conversions: number
  revenue: number
}

export interface MetaCampaign {
  id: string
  name: string
  spend: number
  leads: number
  conversions: number
  revenue: number
  cpl: number
  roas: number
  creatives: MetaCreative[]
}

export interface MetaSummary {
  leads: number
  conversions: number
  revenue: number
  spend: number
  roas: number
}

export interface MetaAttributionData {
  summary: MetaSummary
  campaigns: MetaCampaign[]
}
