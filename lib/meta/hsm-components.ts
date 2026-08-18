// Monta o array `components` da API de Message Templates da Meta a partir
// do shape salvo em hsm_templates. Puro (sem I/O) : os handles de mídia já
// precisam ter sido resolvidos antes de chamar isso (ver
// lib/sdr/meta-template-upload.ts, chamado pela rota de submit).

export interface ButtonSpec {
  type: 'quick_reply' | 'url'
  text: string
  url?: string
}

export interface CarouselCardSpec {
  header_type: 'image' | 'video'
  header_handle: string
  media_url?: string // URL de origem (Supabase Storage) : preservada pra reupload no envio (ver whatsapp-sender.ts)
  body_text: string
  buttons: ButtonSpec[]
}

export interface TemplateSpec {
  kind: 'simple' | 'buttons' | 'carousel'
  body: string
  header_type?: 'none' | 'image' | 'video' | null
  header_handle?: string | null
  buttons?: ButtonSpec[] | null
  carousel_cards?: CarouselCardSpec[] | null
}

function buildButtonsComponent(buttons: ButtonSpec[]) {
  return {
    type: 'BUTTONS',
    buttons: buttons.map((b) =>
      b.type === 'url'
        ? { type: 'URL', text: b.text, url: b.url }
        : { type: 'QUICK_REPLY', text: b.text }
    ),
  }
}

function buildHeaderComponent(headerType: 'image' | 'video', headerHandle: string) {
  return {
    type: 'HEADER',
    format: headerType.toUpperCase(),
    example: { header_handle: [headerHandle] },
  }
}

/**
 * Todos os cards de um carrossel precisam ter estrutura idêntica (mesmo
 * tipo de header, mesma quantidade/tipo de botões, na mesma ordem) — exigência
 * da Meta. Validar aqui evita queimar um ciclo de revisão (até 24h) por erro
 * estrutural bobo.
 */
export function validateCarouselStructure(cards: CarouselCardSpec[]): string | null {
  if (!cards || cards.length < 2) return 'Carrossel precisa de ao menos 2 cards'
  if (cards.length > 10) return 'Carrossel pode ter no máximo 10 cards'

  const first = cards[0]
  for (const c of cards.slice(1)) {
    if (c.header_type !== first.header_type) {
      return 'Todos os cards precisam ter o mesmo tipo de header (imagem ou vídeo)'
    }
    const typesA = (c.buttons ?? []).map((b) => b.type).join(',')
    const typesB = (first.buttons ?? []).map((b) => b.type).join(',')
    if (typesA !== typesB) {
      return 'Todos os cards precisam ter os mesmos tipos de botão, na mesma ordem'
    }
  }
  return null
}

export function buildTemplateComponents(spec: TemplateSpec): unknown[] {
  const components: unknown[] = []

  if (spec.kind === 'simple' && spec.header_type && spec.header_type !== 'none' && spec.header_handle) {
    components.push(buildHeaderComponent(spec.header_type, spec.header_handle))
  }

  components.push({ type: 'BODY', text: spec.body })

  if (spec.kind === 'buttons' && spec.buttons?.length) {
    components.push(buildButtonsComponent(spec.buttons))
  }

  if (spec.kind === 'carousel') {
    const cards = spec.carousel_cards ?? []
    const structErr = validateCarouselStructure(cards)
    if (structErr) throw new Error(structErr)

    components.push({
      type: 'CAROUSEL',
      cards: cards.map((c) => ({
        components: [
          buildHeaderComponent(c.header_type, c.header_handle),
          ...(c.buttons?.length ? [buildButtonsComponent(c.buttons)] : []),
        ],
      })),
    })
  }

  return components
}

// ── Envio (payload diferente de criação : "parameters" no lugar de "example") ──

export interface SendButtonParam {
  subType: 'quick_reply' | 'url'
  index: number
  value: string // payload pro quick_reply, texto da variável da url pro url
}

export interface SendCardSpec {
  cardIndex: number
  mediaType: 'image' | 'video'
  mediaId: string // id da Media Upload API padrão (envio), NÃO o handle de criação
  buttons?: SendButtonParam[]
}

export interface TemplateSendSpec {
  bodyParams?: string[]
  cards?: SendCardSpec[] // só carrossel
}

function buildSendButtonComponent(b: SendButtonParam) {
  return {
    type: 'button',
    sub_type: b.subType,
    index: b.index,
    parameters: [b.subType === 'quick_reply' ? { type: 'payload', payload: b.value } : { type: 'text', text: b.value }],
  }
}

export function buildTemplateSendComponents(spec: TemplateSendSpec): unknown[] {
  const components: unknown[] = []

  if (spec.bodyParams?.length) {
    components.push({ type: 'body', parameters: spec.bodyParams.map((t) => ({ type: 'text', text: t })) })
  }

  if (spec.cards?.length) {
    components.push({
      type: 'carousel',
      cards: spec.cards.map((c) => ({
        card_index: c.cardIndex,
        components: [
          { type: 'header', parameters: [{ type: c.mediaType, [c.mediaType]: { id: c.mediaId } }] },
          ...(c.buttons ?? []).map(buildSendButtonComponent),
        ],
      })),
    })
  }

  return components
}
