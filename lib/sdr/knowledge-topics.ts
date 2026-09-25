// A base de conhecimento é guardada em trechos (documents). Cada trecho começa com o título da seção:
// "=== TÍTULO ===" ou "[TIPO]". Aqui os trechos voltam a ser "assuntos" editáveis e viram texto de novo.

export interface KnowledgeTopic {
  /** Linha de título como está no texto ("=== PREÇOS ==="). Vazio para o texto sem título. */
  header: string
  title: string
  body: string
}

const TAG_RE = /^\[\[DOC_TYPE:(conhecimento|objecoes)\]\]\n/

export function cleanTitle(header: string): string {
  return header
    .replace(/^=+\s*/, '')
    .replace(/\s*=+$/, '')
    .replace(/^\[\s*/, '')
    .replace(/\s*\]$/, '')
    .trim()
}

export function headerFor(title: string, previousHeader?: string): string {
  const t = title.trim()
  if (previousHeader && cleanTitle(previousHeader) === t) return previousHeader
  return previousHeader?.startsWith('[') ? `[${t}]` : `=== ${t} ===`
}

export function parseTopics(storedChunks: string[]): KnowledgeTopic[] {
  const topics: KnowledgeTopic[] = []
  for (const stored of storedChunks) {
    const chunk = stored.replace(TAG_RE, '').trim()
    if (!chunk) continue
    const nl = chunk.indexOf('\n')
    const first = (nl === -1 ? chunk : chunk.slice(0, nl)).trim()
    const rest = nl === -1 ? '' : chunk.slice(nl + 1).trim()
    const isHeader = /^(===|\[)/.test(first)
    const last = topics[topics.length - 1]
    if (isHeader) {
      const cont = first.match(/^(.*) \(cont\.\)$/)
      if (cont && last && last.header === cont[1].trim()) {
        last.body = `${last.body}\n\n${rest}`.trim()
        continue
      }
      topics.push({ header: first, title: cleanTitle(first), body: rest })
    } else if (last) {
      last.body = `${last.body}\n\n${chunk}`.trim()
    } else {
      topics.push({ header: '', title: 'Introdução', body: chunk })
    }
  }
  return topics
}

export function buildText(topics: KnowledgeTopic[]): string {
  return topics
    .map((t) => (t.header ? `${t.header}\n${t.body.trim()}` : t.body.trim()))
    .filter(Boolean)
    .join('\n\n')
}
