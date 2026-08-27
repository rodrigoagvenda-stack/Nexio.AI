/**
 * Extração de leads (Orbit) : port do fluxo n8n "Extração de Leads em Massa"
 * pra código. Roda tudo síncrono numa função só : Apify → enriquecer/MQL →
 * checar WhatsApp (dinâmico por empresa) → resumo IA → categorizar → inserir.
 *
 * Correções em relação ao n8n original (achadas na revisão) :
 * - uazapi dinâmico por company_id (getUazapiForCompany), não mais fixo
 *   num único token/domínio que só funcionava pra uma empresa.
 * - mql_status persiste em leads.nivel_interesse (Quente/Morno/Frio, valores
 *   reais do enum) : antes só entrava no prompt da IA e sumia, quebrando o
 *   filtro de lead frio do outbound.
 * - origem correto ('google_maps', não 'outbound' : isso não veio de
 *   campanha outbound, veio de extração).
 * - sem bônus de MQL hardcoded pra "segmento quente" fixo (pet shop/veterinário
 *   cravado no código, sem sentido pra empresa que não é desse nicho).
 * - sem project_value fixo em R$3000 pra todo lead de toda empresa.
 * - scrapeReviewsPersonalData: false (não precisamos de dado pessoal de quem
 *   avaliou, só dos campos do negócio em si).
 * - callback/complete viram update direto no Supabase (mesma sessão de
 *   execução), não HTTP pra um domínio separado que pode cair.
 */

import { createServiceClient } from '@/lib/supabase/server'
import { getPlatformConfig } from '@/lib/platform-config'
import { resolveOpenAIKey } from './rag'
import { getUazapiForCompany } from './uazapi-for-company'
import { syslog } from '@/lib/logger'
import OpenAI from 'openai'

type Supabase = ReturnType<typeof createServiceClient>

const APIFY_ACTOR_ID = 'nwua9Gu5YrADL7ZDj' // Google Maps Scraper (compass/crawler-google-places)
const MQL_MODEL = 'gpt-4.1-mini'

interface ApifyPlace {
  title?: string
  categoryName?: string
  categories?: string[]
  totalScore?: number
  neighborhood?: string
  city?: string
  website?: string
  phone?: string
  phoneUnformatted?: string
  placeId?: string
  address?: string
  permanentlyClosed?: boolean
  openingHours?: { hours?: string }[]
}

interface EnrichedLead {
  nome: string
  segmento: string
  servicos: string
  nota: number | 'Sem avaliação'
  bairro: string
  cidade: string
  temSite: boolean
  site: string | null
  telefone: string
  placeId: string | null
  endereco: string
  aberto: string
  mqlScore: number
  mqlStatus: 'MQL ✅' | 'Morno 🌡️' | 'Frio ❄️'
  mqlMotivos: string
}

function enriquecer(d: ApifyPlace): Omit<EnrichedLead, 'mqlScore' | 'mqlStatus' | 'mqlMotivos'> {
  return {
    nome: d.title || 'Não informado',
    segmento: d.categoryName || 'Não informado',
    servicos: Array.isArray(d.categories) && d.categories.length > 0 ? d.categories.join(', ') : 'Não informado',
    nota: typeof d.totalScore === 'number' ? d.totalScore : 'Sem avaliação',
    bairro: d.neighborhood || 'Não informado',
    cidade: d.city || 'Não informado',
    temSite: !!d.website,
    site: d.website || null,
    telefone: d.phone || d.phoneUnformatted || 'Não informado',
    placeId: d.placeId || null,
    endereco: d.address || 'Não informado',
    aberto: d.permanentlyClosed === false ? 'Sim' : 'Verificar',
  }
}

/** MQL heurístico genérico : sem bônus de segmento hardcoded, funciona igual
 * pra qualquer empresa/nicho. */
function calcularMQL(base: Omit<EnrichedLead, 'mqlScore' | 'mqlStatus' | 'mqlMotivos'>): EnrichedLead {
  let score = 0
  const motivos: string[] = []

  if (typeof base.nota === 'number') {
    if (base.nota >= 4.5) { score += 30; motivos.push('Nota alta no Google') }
    else if (base.nota >= 4.0) { score += 15; motivos.push('Boa nota no Google') }
  }

  if (base.temSite) { score += 20; motivos.push('Tem site') }
  else { motivos.push('Sem site : oportunidade digital') }

  if (base.aberto === 'Sim') { score += 15; motivos.push('Negócio ativo') }
  if (base.telefone !== 'Não informado') { score += 10; motivos.push('Contato disponível') }

  const mqlStatus: EnrichedLead['mqlStatus'] = score >= 60 ? 'MQL ✅' : score >= 40 ? 'Morno 🌡️' : 'Frio ❄️'

  return { ...base, mqlScore: score, mqlStatus, mqlMotivos: motivos.join(', ') }
}

const MAPEAMENTO_SEGMENTO: Record<string, string> = {
  'restaurante': 'Restaurante', 'academia': 'Academia', 'salão de beleza': 'Beleza/Estética',
  'clínica médica': 'Saúde/Medicina', 'consultório odontológico': 'Saúde/Medicina',
  'escritório de advocacia': 'Advocacia', 'imobiliária': 'Imobiliária', 'agência de marketing': 'Consultoria',
  'loja de roupa': 'Moda/Fashion', 'pet shop': 'Pet Shop', 'oficina mecânica': 'Oficina Mecânica',
  'escola': 'Educação', 'hotel': 'Hotel/Pousada', 'pousada': 'Hotel/Pousada', 'bar': 'Alimentação',
  'cafeteria': 'Alimentação', 'farmácia': 'Farmácia', 'supermercado': 'Supermercado', 'padaria': 'Padaria',
  'floricult': 'Floricultura', 'auto escola': 'Auto Escola', 'veterinár': 'Pet Shop', 'clínica veterinária': 'Pet Shop',
}

function mapearSegmento(segmento: string): string {
  const s = segmento.toLowerCase()
  for (const [chave, valor] of Object.entries(MAPEAMENTO_SEGMENTO)) {
    if (s.includes(chave)) return valor
  }
  return 'Outros'
}

function limparTitulo(title: string): string {
  let t = title
  if (t.includes(' | ')) t = t.split(' | ')[0]
  if (t.includes(' - ')) t = t.split(' - ')[0]
  if (t.includes(',')) t = t.split(',')[0]
  t = t.replace(/\s+em\s+[A-Z][a-zÀ-ú]+.*$/i, '')
  return t.trim()
}

async function runApifyActor(mapsUrl: string, quantity: number, apifyToken: string): Promise<ApifyPlace[]> {
  const res = await fetch(
    `https://api.apify.com/v2/acts/${APIFY_ACTOR_ID}/run-sync-get-dataset-items?token=${apifyToken}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startUrls: [{ url: mapsUrl }],
        language: 'pt-BR',
        maxCrawledPlacesPerSearch: Math.min(quantity, 500),
        skipClosedPlaces: false,
        scrapeReviewsPersonalData: false,
      }),
    }
  )
  if (!res.ok) throw new Error(`Apify falhou (${res.status}): ${(await res.text().catch(() => '')).slice(0, 300)}`)
  return res.json()
}

async function generateMqlResumo(openai: OpenAI, lead: EnrichedLead): Promise<string> {
  const prompt = `Com base nos dados abaixo, escreva um resumo comercial curto e direto sobre esse lead para o SDR saber como abordar.

Máximo 5 linhas. Sem bullet points. Linguagem natural.

Dados:
- Nome: ${lead.nome}
- Segmento: ${lead.segmento}
- Serviços: ${lead.servicos}
- Nota Google: ${lead.nota}
- Bairro: ${lead.bairro}, ${lead.cidade}
- Tem site: ${lead.temSite}
- Aberto: ${lead.aberto}
- Score MQL: ${lead.mqlScore} (${lead.mqlStatus})
- Motivos: ${lead.mqlMotivos}`

  const res = await openai.chat.completions.create({
    model: MQL_MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: 300,
  })
  return res.choices[0]?.message?.content?.trim() || `${lead.nome} : ${lead.mqlMotivos}`
}

function nivelInteresseFromMqlStatus(status: EnrichedLead['mqlStatus']): string {
  if (status === 'MQL ✅') return 'Quente 🔥'
  if (status === 'Morno 🌡️') return 'Morno 🌡️'
  return 'Frio ❄️'
}

async function markSessionComplete(sessionId: string, supabase: Supabase): Promise<void> {
  await supabase.from('extraction_sessions').update({ status: 'complete', completed_at: new Date().toISOString() }).eq('id', sessionId)
}

async function markSessionError(sessionId: string, supabase: Supabase): Promise<void> {
  await supabase.from('extraction_sessions').update({ status: 'error', completed_at: new Date().toISOString() }).eq('id', sessionId)
}

export async function runExtraction(params: {
  sessionId: string
  companyId: number
  mapsUrl: string
  quantity: number
}): Promise<void> {
  const { sessionId, companyId, mapsUrl, quantity } = params
  const supabase = createServiceClient()

  try {
    const platformCfg = await getPlatformConfig()
    if (!platformCfg.apify_api_token) throw new Error('Apify não configurado (Admin → Configurações → Apify)')

    const rawPlaces = await runApifyActor(mapsUrl, quantity, platformCfg.apify_api_token)
    if (!rawPlaces.length) {
      await markSessionComplete(sessionId, supabase)
      return
    }

    const openaiKey = await resolveOpenAIKey(companyId)
    const openai = new OpenAI({ apiKey: openaiKey })
    const uazapi = await getUazapiForCompany(companyId).catch(() => null)

    for (const raw of rawPlaces) {
      try {
        const lead = calcularMQL(enriquecer(raw))
        if (lead.telefone === 'Não informado') continue

        // Checa WhatsApp antes de gastar IA/insert com número morto
        if (uazapi) {
          const [check] = await uazapi.checkWhatsapp([lead.telefone]).catch(() => [])
          if (check && !check.exists) continue
        }

        const mqlResumo = await generateMqlResumo(openai, lead)
        const companyName = limparTitulo(lead.nome)
        const segment = mapearSegmento(lead.segmento)

        const { error } = await supabase.from('leads').insert({
          company_id: companyId,
          company_name: companyName,
          segment,
          website_or_instagram: lead.site,
          whatsapp: lead.telefone,
          status: 'Triagem',
          priority: 'Média',
          import_source: 'PEG',
          mql_resumo: mqlResumo,
          nivel_interesse: nivelInteresseFromMqlStatus(lead.mqlStatus),
          origem: 'google_maps',
        })
        if (error) throw new Error(error.message)

        await supabase.rpc('increment_extraction_session', { p_session_id: sessionId })
      } catch (err: any) {
        await syslog({
          type: 'extraction',
          severity: 'error',
          message: `Erro ao processar lead: ${err?.message ?? 'erro desconhecido'}`,
          company_id: companyId,
          payload: { sessionId, whatsapp: raw.phone || raw.phoneUnformatted || null },
        })
      }
    }

    await markSessionComplete(sessionId, supabase)
  } catch (err: any) {
    await markSessionError(sessionId, supabase)
    throw err
  }
}
