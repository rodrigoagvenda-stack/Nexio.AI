/**
 * Guarda de saída do SDR : filtro determinístico aplicado nos blocos que o
 * modelo gerou, ANTES de qualquer coisa ir pro WhatsApp do lead.
 *
 * Por que existe : regra escrita em prompt ("uma pergunta por vez", "não
 * repita frase", "não se reapresente") o modelo viola de forma
 * probabilística, mesmo quando o dado no checklist está certo (achado ao vivo,
 * 2026-09-18: lead Anderson, apresentacao_feita=true e o SDR se reapresentou
 * mesmo assim). Esta camada não depende do modelo obedecer.
 *
 * É rede de segurança pro motor atual (orquestrador livre), válida pra toda
 * empresa. Não substitui o funil em código (v2), onde essas violações deixam de
 * ser possíveis por construção. A regra de justificativa (R3) é a única baseada
 * em lista de frases, é a mais frágil, e deve sair quando o v2 assumir.
 *
 * Função pura : sem banco, sem rede, testável com transcrições reais
 * (scripts/test-output-guard.ts).
 */

export interface GuardRules {
  /** Remove frases com valor em reais (R$ 1.125). Só pra empresas com regra "nunca revelar preço". */
  blockPrice?: boolean
  /** Máximo de menções a "gratuito/grátis/sem custo" por conversa. undefined = sem limite. */
  maxGratuito?: number
}

export interface GuardContext {
  /** Mensagens de saída recentes da conversa (qualquer ordem). */
  recentOutbound: string[]
  /** As primeiras mensagens de saída da conversa, em ordem cronológica (a abertura/apresentação). */
  firstOutbound: string[]
  /** Total de mensagens de saída já enviadas nesta conversa. */
  totalOutbound: number
  /** Quantas mensagens de saída recentes já usaram "gratuito/grátis/sem custo". */
  gratuitoCount: number
  rules?: GuardRules
}

export type GuardRule =
  | 'R1_uma_pergunta'
  | 'R2a_repeticao_recente'
  | 'R2b_reapresentacao'
  | 'R3_justificativa'
  | 'R4_preco'
  | 'R4_gratuito'

export interface GuardViolation {
  rule: GuardRule
  before: string
  /** Texto que ficou no lugar (null = bloco inteiro removido). */
  after: string | null
}

export interface GuardResult {
  paragraphs: string[]
  violations: GuardViolation[]
}

// ─── Utilitários ────────────────────────────────────────────────────────

function normalizeTokens(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0
  const sa = new Set(a)
  const sb = new Set(b)
  let inter = 0
  for (const t of sa) if (sb.has(t)) inter++
  return inter / (sa.size + sb.size - inter)
}

const MIN_TOKENS_FOR_SIMILARITY = 3
const MIN_TOKENS_FOR_CONTAINMENT = 5
const CONTAINMENT_THRESHOLD = 0.9

/**
 * Repetição = muito parecido (Jaccard) OU um contido quase inteiro no outro
 * (coeficiente de sobreposição), pra pegar a mesma frase com um rabicho novo
 * ("...horários disponíveis pra você?" -> "...pra você conversar com ele?").
 */
function similar(a: string, b: string, threshold: number): boolean {
  const ta = normalizeTokens(a)
  const tb = normalizeTokens(b)
  if (ta.length < MIN_TOKENS_FOR_SIMILARITY || tb.length < MIN_TOKENS_FOR_SIMILARITY) return false
  if (jaccard(ta, tb) >= threshold) return true
  const minLen = Math.min(ta.length, tb.length)
  const sa = new Set(ta)
  const sb = new Set(tb)
  let inter = 0
  for (const t of sa) if (sb.has(t)) inter++
  const overlap = inter / Math.min(sa.size, sb.size)
  // Frase curta (3 a 4 palavras) só é repetição se estiver INTEIRA dentro da outra
  // ("Eu que agradeço!" dentro de "Eu que agradeço, André!") : achado ao vivo
  // 2026-09-19, lead André recebeu a despedida duas vezes seguidas.
  if (minLen < MIN_TOKENS_FOR_CONTAINMENT) return overlap === 1
  return overlap >= CONTAINMENT_THRESHOLD
}

// "Tudo bem?" de abertura é cumprimento, não pergunta de qualificação.
const GREETING_QUESTION_RE = /(tudo\s+(bem|bom|certo|joia)|td\s+bem|como\s+(vai|est[áa])(\s+voc[êe])?)\s*\?/gi

function countsAsQuestion(block: string): boolean {
  return block.replace(GREETING_QUESTION_RE, '').includes('?')
}

/** Usados pelo harness de avaliação pra checar o que de fato saiu pro lead. */
export const isQuestionBlock = countsAsQuestion
export const isRepeatOf = (a: string, b: string): boolean => similar(a, b, 0.85)
export const hasPrice = (text: string): boolean => /R\$\s?\d/.test(text)
export function hasJustification(text: string): boolean {
  return stripJustification(text) !== text
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function capitalizeFirst(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s
}

// ─── R3 : justificativa emendada ────────────────────────────────────────
// Padrão medido em 11+ leads em 3 dias (2026-09-15 a 2026-09-18) : "Assim
// consigo...", "Isso me ajuda a...", "Pra te direcionar certinho, ...".
// "Assim que finalizar..." NÃO é justificativa (é instrução) e não casa aqui.

const JUSTIFICATION_SENTENCE_RES: RegExp[] = [
  /^assim\s+(já\s+)?(consigo|começo|posso|seguimos|deixo|levo|agilizo|facilito|vou|eu\s+(já\s+)?(consigo|posso|começo|deixo)|te\s+(explico|mostro|oriento|direciono|ajudo))\b/i,
  /^isso\s+(me\s+)?(ajuda|permite)\b/i,
]

const JUSTIFICATION_PREFIX_RE =
  /^((agora|antes\s+disso|então),?\s+)?(só\s+)?(pra|para)\s+(a\s+gente\s+|gente\s+|eu\s+)?(te\s+)?(direcionar|ajudar|entender|avançar|seguir|poder)\b[^,:?!.]*[,:]\s*/i

function stripJustification(paragraph: string): string {
  const kept: string[] = []
  for (const sentence of splitSentences(paragraph)) {
    if (JUSTIFICATION_SENTENCE_RES.some((re) => re.test(sentence))) continue
    const withoutPrefix = sentence.replace(JUSTIFICATION_PREFIX_RE, '')
    kept.push(withoutPrefix === sentence ? sentence : capitalizeFirst(withoutPrefix))
  }
  return kept.join(' ')
}

// ─── R4 : regras opcionais por empresa ──────────────────────────────────

const PRICE_RE = /R\$\s?\d/
const GRATUITO_RE = /gratuit[oa]s?|gr[áa]tis|sem\s+custo/i

export function mentionsGratuito(text: string): boolean {
  return GRATUITO_RE.test(text)
}

function dropSentences(paragraph: string, shouldDrop: (s: string) => boolean): string {
  return splitSentences(paragraph)
    .filter((s) => s.includes('?') || !shouldDrop(s))
    .join(' ')
}

// ─── Guarda ─────────────────────────────────────────────────────────────

export function guardOutput(input: string[], ctx: GuardContext): GuardResult {
  const violations: GuardViolation[] = []
  let blocks = input.map((p) => p.trim()).filter(Boolean)

  // Passe 1 : limpeza por bloco (R3, R4)
  let gratuitoCount = ctx.gratuitoCount
  const cleaned: string[] = []
  for (const original of blocks) {
    let text = original

    const semJustificativa = stripJustification(text)
    if (semJustificativa !== text) {
      violations.push({ rule: 'R3_justificativa', before: text, after: semJustificativa || null })
      text = semJustificativa
    }

    if (text && ctx.rules?.blockPrice && PRICE_RE.test(text)) {
      const semPreco = dropSentences(text, (s) => PRICE_RE.test(s))
      if (semPreco !== text) {
        violations.push({ rule: 'R4_preco', before: text, after: semPreco || null })
        text = semPreco
      }
    }

    if (text && ctx.rules?.maxGratuito !== undefined && GRATUITO_RE.test(text)) {
      if (gratuitoCount >= ctx.rules.maxGratuito) {
        const semGratuito = dropSentences(text, (s) => GRATUITO_RE.test(s))
        if (semGratuito !== text) {
          violations.push({ rule: 'R4_gratuito', before: text, after: semGratuito || null })
          text = semGratuito
        }
      } else {
        gratuitoCount++
      }
    }

    if (text.trim()) cleaned.push(text.trim())
  }
  blocks = cleaned

  // Passe 2 : reapresentação (R2b). Depois da abertura, repetir a
  // apresentação ou a pergunta de nome nunca é certo : silêncio é melhor.
  if (ctx.totalOutbound >= 4 && ctx.firstOutbound.length > 0) {
    blocks = blocks.filter((b) => {
      const repeteAbertura = ctx.firstOutbound.some((f) => similar(b, f, 0.8))
      if (repeteAbertura) violations.push({ rule: 'R2b_reapresentacao', before: b, after: null })
      return !repeteAbertura
    })
  }

  // Passe 3 : repetição recente (R2a). Nunca esvazia a rajada sozinha :
  // se tudo for repetição, mantém como estava (o lead pode ter pedido de novo).
  const filtrados = blocks.filter((b) => !ctx.recentOutbound.some((r) => similar(b, r, 0.85)))
  if (filtrados.length > 0 && filtrados.length < blocks.length) {
    for (const b of blocks) {
      if (!filtrados.includes(b)) violations.push({ rule: 'R2a_repeticao_recente', before: b, after: null })
    }
    blocks = filtrados
  }

  // Passe 4 : uma pergunta por rajada (R1). Mantém o primeiro bloco com
  // pergunta, remove os seguintes que também perguntam.
  let jaTemPergunta = false
  blocks = blocks.filter((b) => {
    if (!countsAsQuestion(b)) return true
    if (!jaTemPergunta) {
      jaTemPergunta = true
      return true
    }
    violations.push({ rule: 'R1_uma_pergunta', before: b, after: null })
    return false
  })

  return { paragraphs: blocks, violations }
}
