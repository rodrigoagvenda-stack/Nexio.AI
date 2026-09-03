/**
 * Análise de perfil Google Meu Negócio via Places API (New).
 *
 * Feature exclusiva (gate por `company.features.places_analysis`, não é
 * produto geral do Zaapply). Fórmula de score e campos de API vieram do
 * Bruno (Grupo Venda), que já validou isso em produção numa ferramenta
 * própria (gbp-analisador.html) — a rubrica abaixo é a mesma dele, exata.
 *
 * Os textos de recomendação (buildGaps) são texto NOSSO, não o texto literal
 * dele (não tivemos acesso ao código-fonte, só à descrição da lógica) — mesma
 * ideia (severidade por faixa de %, um texto por critério), copy própria.
 *
 * Campos manuais (taxaResposta, produtosServicos, postsUltimos90Dias,
 * diasUltimaFoto) não existem na Places API : o Bruno confirmou isso testando
 * com fieldMask `*`. Ficam `unknown: true` até alguém preencher manualmente.
 */

const PLACES_BASE = 'https://places.googleapis.com/v1'

export interface PlaceDetails {
  id: string
  displayName?: { text: string }
  types?: string[]
  primaryType?: string
  formattedAddress?: string
  websiteUri?: string
  nationalPhoneNumber?: string
  rating?: number
  userRatingCount?: number
  reviews?: { rating?: number; publishTime?: string; text?: { text?: string } }[]
  editorialSummary?: { text?: string }
  generativeSummary?: { overview?: { text?: string } }
  regularOpeningHours?: { periods?: unknown[]; weekdayDescriptions?: string[] }
  photos?: { name: string; widthPx?: number; heightPx?: number }[]
  businessStatus?: string
}

export interface ManualInputs {
  taxaRespostaAvaliacoes?: number // 0-100, opcional
  produtosServicosCadastrados?: boolean
  postsUltimos90Dias?: number
  diasUltimaFoto?: number // estimativa : Places API não expõe data por foto
}

export interface CriterioScore {
  key: string
  label: string
  pontos: number
  pesoMax: number
  pct: number
  unknown?: boolean
}

export interface PlacesScoreResult {
  total: number
  grade: 'Excelente' | 'Bom' | 'Regular' | 'Crítico'
  criterios: CriterioScore[]
}

export interface Gap {
  key: string
  severidade: 'critico' | 'atencao'
  titulo: string
  texto: string
  unknown?: boolean
}

/** Extrai o nome do negócio da URL colada do Google Maps e, se tiver
 * coordenadas (@lat,lng), devolve como locationBias. Mesmo regex do Bruno. */
function parseMapsUrl(mapsUrl: string): { nome: string | null; lat?: number; lng?: number } {
  const nomeMatch = mapsUrl.match(/\/place\/([^/@]+)\//)
  const nome = nomeMatch ? decodeURIComponent(nomeMatch[1].replace(/\+/g, ' ')) : null

  const coordMatch = mapsUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
  const lat = coordMatch ? parseFloat(coordMatch[1]) : undefined
  const lng = coordMatch ? parseFloat(coordMatch[2]) : undefined

  return { nome, lat, lng }
}

/** Text Search : resolve o place_id a partir do nome extraído da URL. */
export async function resolvePlaceId(mapsUrl: string, apiKey: string): Promise<string> {
  const { nome, lat, lng } = parseMapsUrl(mapsUrl)
  if (!nome) throw new Error('Não consegui extrair o nome do negócio dessa URL do Google Maps')

  const body: Record<string, unknown> = { textQuery: nome }
  if (lat !== undefined && lng !== undefined) {
    body.locationBias = { circle: { center: { latitude: lat, longitude: lng }, radius: 5000 } }
  }

  const res = await fetch(`${PLACES_BASE}/places:searchText`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) throw new Error(`Places Text Search falhou (${res.status}): ${await res.text().catch(() => '')}`)
  const data = await res.json()
  const placeId = data.places?.[0]?.id
  if (!placeId) throw new Error('Nenhum lugar encontrado pra essa busca no Places API')
  return placeId
}

const DETAILS_FIELD_MASK = [
  'id', 'displayName', 'types', 'primaryType', 'primaryTypeDisplayName',
  'formattedAddress', 'shortFormattedAddress', 'addressComponents', 'plusCode', 'location',
  'internationalPhoneNumber', 'nationalPhoneNumber', 'websiteUri', 'googleMapsUri',
  'regularOpeningHours', 'currentOpeningHours', 'regularSecondaryOpeningHours', 'currentSecondaryOpeningHours',
  'utcOffsetMinutes', 'timeZone',
  'rating', 'userRatingCount', 'reviews', 'reviewSummary', 'editorialSummary', 'generativeSummary', 'neighborhoodSummary',
  'photos', 'businessStatus', 'openingDate',
  'priceLevel', 'priceRange',
  'outdoorSeating', 'liveMusic', 'menuForChildren', 'goodForChildren', 'allowsDogs', 'restroom', 'goodForGroups', 'goodForWatchingSports',
  'paymentOptions', 'parkingOptions', 'accessibilityOptions',
  'servesBreakfast', 'servesLunch', 'servesDinner', 'servesBrunch', 'servesBeer', 'servesWine', 'servesCocktails', 'servesCoffee', 'servesDessert', 'servesVegetarianFood',
  'takeout', 'delivery', 'dineIn', 'curbsidePickup', 'reservable',
].join(',')

/** Place Details : a chamada principal, fieldMask completo (~57 campos, igual o gbp-analisador). */
export async function fetchPlaceDetails(placeId: string, apiKey: string): Promise<PlaceDetails> {
  const res = await fetch(`${PLACES_BASE}/places/${placeId}?languageCode=pt-BR`, {
    headers: {
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': DETAILS_FIELD_MASK,
    },
  })
  if (!res.ok) throw new Error(`Places Details falhou (${res.status}): ${await res.text().catch(() => '')}`)
  return res.json()
}

/** Photo Media : até `max` fotos, resolvidas em paralelo. */
export async function resolvePhotoUrls(photos: PlaceDetails['photos'], apiKey: string, max = 6): Promise<string[]> {
  const subset = (photos ?? []).slice(0, max)
  const urls = await Promise.all(
    subset.map(async (photo) => {
      try {
        const res = await fetch(
          `${PLACES_BASE}/${photo.name}/media?maxWidthPx=1200&skipHttpRedirect=true`,
          { headers: { 'X-Goog-Api-Key': apiKey } }
        )
        if (!res.ok) return null
        const data = await res.json()
        return data.photoUri as string | null
      } catch {
        return null
      }
    })
  )
  return urls.filter((u): u is string => !!u)
}

function diasDesde(iso?: string): number | null {
  if (!iso) return null
  const diff = Date.now() - new Date(iso).getTime()
  return Math.floor(diff / 86_400_000)
}

/** Rubrica exata do Bruno : 9 critérios somando 100. */
export function computePlacesScore(details: PlaceDetails, manual: ManualInputs = {}): PlacesScoreResult {
  const criterios: CriterioScore[] = []

  // 1. Categorização (15) : principal preenchida = 10 + min(secundárias*2, 5)
  {
    const temPrincipal = !!details.primaryType
    const secundarias = Math.max(0, (details.types?.length ?? 0) - (temPrincipal ? 1 : 0))
    const pontos = (temPrincipal ? 10 : 0) + Math.min(secundarias * 2, 5)
    criterios.push({ key: 'categorizacao', label: 'Categorização', pontos, pesoMax: 15, pct: (pontos / 15) * 100 })
  }

  // 2. Site vinculado (15) : binário
  {
    const pontos = details.websiteUri ? 15 : 0
    criterios.push({ key: 'site', label: 'Site vinculado', pontos, pesoMax: 15, pct: (pontos / 15) * 100 })
  }

  // 3. Avaliações (20) : nota (10) + volume (7) + recência (3)
  {
    const nota = details.rating ?? 0
    const volume = details.userRatingCount ?? 0
    const notaPts = (nota / 5) * 10
    const volumePts = volume >= 100 ? 7 : volume >= 30 ? 5 : volume >= 10 ? 3 : volume > 0 ? 1 : 0
    const ultimaAvaliacao = details.reviews?.[0]?.publishTime
    const diasUltimaAvaliacao = diasDesde(ultimaAvaliacao)
    const recenciaPts =
      diasUltimaAvaliacao === null ? 0 : diasUltimaAvaliacao <= 30 ? 3 : diasUltimaAvaliacao <= 90 ? 2 : diasUltimaAvaliacao <= 180 ? 1 : 0
    const pontos = notaPts + volumePts + recenciaPts
    criterios.push({ key: 'avaliacoes', label: 'Avaliações', pontos, pesoMax: 20, pct: (pontos / 20) * 100 })
  }

  // 4. Fotos (10) : quantidade (6, real da API) + recência estimada (4, chute)
  // Achado ao vivo (2026-09-03) : antes isso era 1 critério só, marcado
  // "unknown" inteiro sempre que a recência faltava (quase sempre), o que
  // descartava também a contagem de fotos, que é dado 100% real da API
  // (photos.length) e é justamente a recomendação oficial do Google
  // ("adicionar fotos e vídeos", support.google.com/business/answer/7091).
  // Separado em dois critérios pra contagem virar gap citável de verdade.
  {
    const qtd = details.photos?.length ?? 0
    const qtdPts = qtd >= 50 ? 6 : qtd >= 20 ? 4 : qtd >= 5 ? 2 : 0
    criterios.push({ key: 'fotos_qtd', label: 'Quantidade de fotos', pontos: qtdPts, pesoMax: 6, pct: (qtdPts / 6) * 100 })

    const diasUltimaFoto = manual.diasUltimaFoto
    const recenciaPts = diasUltimaFoto === undefined ? 0 : diasUltimaFoto <= 30 ? 4 : diasUltimaFoto <= 90 ? 2 : 0
    criterios.push({
      key: 'fotos_recencia', label: 'Recência das fotos', pontos: recenciaPts, pesoMax: 4, pct: (recenciaPts / 4) * 100,
      unknown: diasUltimaFoto === undefined,
    })
  }

  // 5. Atividade de posts (8) : manual, Places API não expõe
  {
    const posts = manual.postsUltimos90Dias
    const pontos = posts === undefined ? 0 : posts >= 4 ? 8 : posts >= 1 ? 4 : 0
    criterios.push({
      key: 'posts', label: 'Atividade de posts', pontos, pesoMax: 8, pct: (pontos / 8) * 100,
      unknown: posts === undefined,
    })
  }

  // 6. Horário de funcionamento (10) : binário
  {
    const temHorario = (details.regularOpeningHours?.periods?.length ?? 0) > 0
    const pontos = temHorario ? 10 : 0
    criterios.push({ key: 'horario', label: 'Horário de funcionamento', pontos, pesoMax: 10, pct: (pontos / 10) * 100 })
  }

  // 7. Descrição do perfil (10) : tem texto = 5 + 5 extra se >=80 chars
  {
    const texto = details.editorialSummary?.text || details.generativeSummary?.overview?.text || ''
    const pontos = texto ? 5 + (texto.length >= 80 ? 5 : 0) : 0
    criterios.push({ key: 'descricao', label: 'Descrição do perfil', pontos, pesoMax: 10, pct: (pontos / 10) * 100 })
  }

  // 8. Resposta a avaliações (5) : manual
  {
    const taxa = manual.taxaRespostaAvaliacoes
    const pontos = taxa === undefined ? 0 : (taxa / 100) * 5
    criterios.push({
      key: 'resposta', label: 'Resposta a avaliações', pontos, pesoMax: 5, pct: (pontos / 5) * 100,
      unknown: taxa === undefined,
    })
  }

  // 9. Produtos/serviços cadastrados (7) : manual, binário
  {
    const cadastrado = manual.produtosServicosCadastrados
    const pontos = cadastrado ? 7 : 0
    criterios.push({
      key: 'produtos', label: 'Produtos/serviços cadastrados', pontos, pesoMax: 7, pct: (pontos / 7) * 100,
      unknown: cadastrado === undefined,
    })
  }

  const total = Math.round(criterios.reduce((acc, c) => acc + c.pontos, 0))
  const grade: PlacesScoreResult['grade'] = total >= 90 ? 'Excelente' : total >= 75 ? 'Bom' : total >= 55 ? 'Regular' : 'Crítico'

  return { total, grade, criterios }
}

/**
 * Textos de recomendação : copy nossa (não temos o texto literal do Bruno),
 * mesma ideia — severidade por faixa de %, um texto por critério, com os
 * valores reais interpolados.
 */
export function buildGaps(score: PlacesScoreResult, details: PlaceDetails, manual: ManualInputs): Gap[] {
  const gaps: Gap[] = []
  const severidade = (pct: number): 'critico' | 'atencao' | null => (pct < 40 ? 'critico' : pct < 80 ? 'atencao' : null)

  for (const c of score.criterios) {
    const sev = severidade(c.pct)
    if (!sev) continue

    let titulo = ''
    let texto = ''

    switch (c.key) {
      case 'categorizacao':
        titulo = 'Categorização incompleta'
        texto = `O perfil tem poucas categorias registradas. Categorias secundárias ajudam o Google a mostrar o negócio em mais buscas relacionadas.`
        break
      case 'site':
        titulo = 'Sem site vinculado'
        texto = `O perfil não tem site cadastrado. Isso reduz a confiança de quem pesquisa e tira uma via direta de conversão.`
        break
      case 'avaliacoes':
        texto = `Nota ${(details.rating ?? 0).toFixed(1)} com ${details.userRatingCount ?? 0} avaliações. ${
          (details.userRatingCount ?? 0) < 30 ? 'Volume baixo comparado ao que costuma converter bem localmente.' : 'Faz tempo desde a última avaliação recente.'
        }`
        titulo = 'Avaliações precisam de atenção'
        break
      case 'fotos_qtd': {
        const qtd = details.photos?.length ?? 0
        titulo = qtd === 0 ? 'Perfil sem nenhuma foto' : 'Poucas fotos no perfil'
        texto = `${qtd} foto${qtd === 1 ? '' : 's'} no perfil. O Google recomenda oficialmente adicionar fotos e vídeos : perfis com mais fotos recebem mais cliques e passam mais confiança antes do primeiro contato.`
        break
      }
      case 'fotos_recencia':
        titulo = 'Data das fotos não confirmada'
        texto = `Não temos como confirmar há quanto tempo as fotos foram atualizadas pela API do Google.`
        break
      case 'posts':
        titulo = 'Perfil sem atividade de posts'
        texto = `Nenhum post recente identificado. Postagens frequentes sinalizam ao Google que o negócio está ativo.`
        break
      case 'horario':
        titulo = 'Horário de funcionamento incompleto'
        texto = `Horário não está totalmente preenchido. Horário incompleto é motivo comum de perda de cliente que desiste antes de ligar.`
        break
      case 'descricao':
        titulo = 'Descrição ausente ou muito curta'
        texto = `A descrição do perfil está vazia ou tem menos de 80 caracteres. É um dos poucos campos de texto livre do perfil e deveria reforçar especialidade, diferencial e região de atuação.`
        break
      case 'resposta':
        titulo = 'Taxa de resposta a avaliações desconhecida ou baixa'
        texto = `Responder toda avaliação em até 24h é prática recomendada e citada pelo próprio Google como fator de confiança.`
        break
      case 'produtos':
        titulo = 'Produtos/serviços não cadastrados'
        texto = `O perfil não lista produtos ou serviços. Esse campo ajuda o cliente a entender a oferta antes mesmo de entrar em contato.`
        break
    }

    gaps.push({ key: c.key, severidade: sev, titulo, texto, unknown: c.unknown })
  }

  // Ordena crítico primeiro, depois por menor % (mais impacto primeiro)
  return gaps.sort((a, b) => {
    if (a.severidade !== b.severidade) return a.severidade === 'critico' ? -1 : 1
    return 0
  })
}

/** Resumo curto (pro contexto do outbound/SDR) : 5-6 linhas, factual, sem invenção.
 * 4 gaps (não 2) pra abordagem consultiva conseguir listar vários problemas
 * concretos antes de puxar pra call, em vez de só 1 gancho isolado.
 *
 * `unknown: true` : achado ao vivo (2026-09-03, caso Figueiredo Advogados,
 * lead real reagiu mal a "perfil sem posts"/"sem produtos cadastrados", que
 * a gente não tinha como confirmar, só assumia por falta de dado da Places
 * API). Fora daqui : nunca citar como fato pro lead algo que só é "unknown",
 * não gap comprovado. Continua aparecendo no painel interno (buildGaps), só
 * não alimenta mais a mensagem de prospecção. */
export function summarizeForOutreach(details: PlaceDetails, score: PlacesScoreResult, gaps: Gap[]): string {
  const nome = details.displayName?.text ?? 'o negócio'
  const criticos = gaps.filter((g) => g.severidade === 'critico' && !g.unknown).slice(0, 4)
  const linhas = [
    `${nome}: nota ${(details.rating ?? 0).toFixed(1)} (${details.userRatingCount ?? 0} avaliações), perfil Google score ${score.total}/100 (${score.grade}).`,
    ...criticos.map((g) => `Gap: ${g.titulo}.`),
  ]
  return linhas.join('\n')
}
