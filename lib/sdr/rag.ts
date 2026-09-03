/**
 * RAG : Upload de PDF/texto, chunking, embeddings e inserção na tabela `documents`.
 *
 * Módulos pesados são lazy:
 *   - OpenAI: await import('openai') dentro de cada função (não no topo do módulo)
 *   - pdf-parse / pdfjs-dist: isolados em lib/pdf-extractor.ts + serverExternalPackages
 */

import { createServiceClient } from '@/lib/supabase/server'
import { getPlatformConfig } from '@/lib/platform-config'
import { decrypt } from '@/lib/crypto'
import type OpenAI from 'openai'  // type-only: apagado em compile-time, sem impacto no bundle

// Cache compartilhado por API key : evita criar instâncias duplicadas entre chamadas
const _openaiCache = new Map<string, OpenAI>()
async function getOpenAIClient(apiKey: string): Promise<OpenAI> {
  if (!_openaiCache.has(apiKey)) {
    const { default: OpenAIClass } = await import('openai')
    _openaiCache.set(apiKey, new OpenAIClass({ apiKey }))
  }
  return _openaiCache.get(apiKey)!
}

/** Resolve OpenAI key: env var → sdr_configs (empresa) → platform_config (global) */
export async function resolveOpenAIKey(companyId: number): Promise<string> {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY

  try {
    const supabase = createServiceClient()
    const { data: cfg } = await supabase
      .from('sdr_configs').select('openai_key').eq('company_id', companyId).single()
    if (cfg?.openai_key) return decrypt(cfg.openai_key)
  } catch { /* ignora : tenta platform_config */ }

  const platform = await getPlatformConfig()
  if (platform.openai_api_key) return platform.openai_api_key

  throw new Error('Chave OpenAI não configurada. Adicione OPENAI_API_KEY nas variáveis de ambiente do EasyPanel, ou acesse Admin → Configurações de Plataforma.')
}

/** Gera embeddings para TODOS os chunks em uma única chamada */
async function embedAll(chunks: string[], openai: OpenAI): Promise<number[][]> {
  if (chunks.length === 0) return []
  const res = await openai.embeddings.create({ model: 'text-embedding-3-small', input: chunks })
  return res.data.map((d) => d.embedding)
}

/**
 * Tag de tipo + contexto mínimo pro chunk : resolve a auditoria de RAG (achado 1
 * e 8). `documents` guarda conhecimento e objeções juntos na mesma tabela, e a
 * busca hoje não filtrava por tipo (achado 1) : chunk de objeção podia voltar
 * numa pergunta de conhecimento e vice-versa. A tag `[[DOC_TYPE:x]]` no início
 * do content guardado permite filtrar isso no lado da aplicação sem precisar
 * alterar a função SQL match_documents (que não tenho acesso pra inspecionar
 * com segurança nessa sessão).
 *
 * O prefixo de contexto no texto QUE VAI PRO EMBEDDING (embedText, diferente
 * do que fica guardado) é uma versão simplificada da técnica "Contextual
 * Retrieval" da Anthropic (redução de até 35-67% em falha de busca, conforme
 * pesquisa publicada) : aqui sem chamada de IA extra por chunk, só um rótulo
 * estático que já ajuda o embedding a diferenciar tipo de conteúdo.
 */
export const DOC_TYPE_TAG_RE = /^\[\[DOC_TYPE:(conhecimento|objecoes)\]\]\n/

export function tagChunk(
  content: string,
  docType: 'conhecimento' | 'objecoes',
  companyName?: string | null
): { stored: string; embedText: string } {
  const stored = `[[DOC_TYPE:${docType}]]\n${content}`
  const label = docType === 'conhecimento' ? 'Base de conhecimento do produto' : 'Base de scripts de objeções'
  const embedText = `${label}${companyName ? ` (${companyName})` : ''} : ${content}`
  return { stored, embedText }
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

const CORRECTION_SIMILARITY_THRESHOLD = 0.82

/**
 * Reconcilia correções acumuladas (achado 2/3 da auditoria, revisado após
 * achar 5 correções quase-duplicadas/contraditórias vivas na base da Grupo
 * Venda em produção : o cap por contagem sozinho NUNCA resolvia duplicação,
 * só adiava : uma correção sobre "revelar preço direto" e outra sobre
 * "só revelar preço após checklist de orçamento" conviviam as duas, porque
 * nada comparava o CONTEÚDO da correção nova com o que já existia.
 *
 * Antes de inserir uma correção nova : busca as correções existentes do
 * mesmo flow+tipo, compara por similaridade de embedding (não só created_at)
 * e APAGA as que tratam do mesmo assunto, pra a nova substituir de verdade
 * em vez de empilhar por cima. O cap por contagem continua como rede de
 * segurança, bem mais baixo, pro caso de correções sobre assuntos distintos
 * legitimamente se acumularem.
 */
export async function capCorrectionChunks(
  supabase: ReturnType<typeof createServiceClient>,
  companyId: number,
  flowId: string,
  docType: string,
  newEmbedding?: number[],
  maxKeep = 7
): Promise<void> {
  const { data } = await supabase
    .from('documents')
    .select('id, created_at, embedding')
    .eq('company_id', companyId)
    .contains('metadata', { flow_id: flowId, doc_type: docType, is_correction: true })
    .order('created_at', { ascending: false })

  if (!data || data.length === 0) return

  const idsToDelete = new Set<number>()

  if (newEmbedding) {
    for (const row of data) {
      const existingEmbedding = row.embedding as unknown as number[] | null
      if (!existingEmbedding) continue
      if (cosineSimilarity(newEmbedding, existingEmbedding) >= CORRECTION_SIMILARITY_THRESHOLD) {
        idsToDelete.add(row.id)
      }
    }
  }

  const remaining = data.filter((r) => !idsToDelete.has(r.id))
  for (const row of remaining.slice(maxKeep)) idsToDelete.add(row.id)

  if (idsToDelete.size === 0) return
  await supabase.from('documents').delete().in('id', Array.from(idsToDelete))
}

const MAX_CHUNK_CHARS = 1100 // ~300 tokens : um assunto por chunk

function chunkText(text: string): string[] {
  const trimmed = text.trimStart()
  const isStructured = /\n=== |\n\[/.test(text) || trimmed.startsWith('[') || trimmed.startsWith('===')

  if (isStructured) {
    // Split nos marcadores de seção: === TÍTULO === ou [TIPO]
    const parts = text.split(/\n(?====|\[)/).map((s) => s.trim()).filter((s) => s.length > 30)
    const chunks: string[] = []

    for (const part of parts) {
      if (part.length <= MAX_CHUNK_CHARS) {
        chunks.push(part)
        continue
      }

      // Seção grande: extrai o título e divide por parágrafos mantendo o título prefixado
      const firstNewline = part.indexOf('\n')
      const title = firstNewline > -1 ? part.slice(0, firstNewline).trim() : ''
      const body = firstNewline > -1 ? part.slice(firstNewline + 1) : part

      const paras = body.split(/\n\n+/)
      let current = title // sempre começa com o título da seção

      for (const para of paras) {
        const addition = current === title ? '\n' + para : '\n\n' + para
        if (current.length + addition.length > MAX_CHUNK_CHARS) {
          if (current !== title) chunks.push(current.trim())
          // Próximo sub-chunk: prefixar título com "(cont.)" para manter contexto no embedding
          current = title ? `${title} (cont.)\n${para}` : para
        } else {
          current += addition
        }
      }
      if (current.trim() && current.trim() !== title) chunks.push(current.trim())
    }

    return chunks.filter((c) => c.length > 50)
  }

  // PDFs / plain text: fallback por tamanho com overlap mínimo
  const CHUNK_SIZE = 1100
  const CHUNK_OVERLAP = 100
  const chunks: string[] = []
  let start = 0
  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length)
    chunks.push(text.slice(start, end).trim())
    if (end >= text.length) break
    start = end - CHUNK_OVERLAP
  }
  return chunks.filter((c) => c.length > 50)
}

/** Remove chunks antigos da tabela documents para company+flow+tipo */
async function deleteOldChunks(
  supabase: ReturnType<typeof createServiceClient>,
  companyId: number,
  flowId: string,
  docType: string
) {
  await supabase
    .from('documents')
    .delete()
    .eq('company_id', companyId)
    .contains('metadata', { flow_id: flowId, doc_type: docType })
}

export async function processKnowledgePdf(params: {
  companyId: number
  flowId: string
  filename: string
  fileBuffer: Buffer
  tableType: 'conhecimento' | 'objecoes'
  companyName?: string | null
}): Promise<{ chunks: number; table: string }> {
  const { companyId, flowId, filename, fileBuffer, tableType, companyName } = params
  const supabase = createServiceClient()

  const openaiKey = await resolveOpenAIKey(companyId)
  const openai = await getOpenAIClient(openaiKey)

  // Lazy import : pdf-parse/pdfjs-dist só carregam para uploads de PDF
  const { extractTextFromPdf } = await import('@/lib/pdf-extractor')
  const rawText = await extractTextFromPdf(fileBuffer)
  if (!rawText.trim()) throw new Error('PDF sem texto extraível')

  const chunks = chunkText(rawText)
  await deleteOldChunks(supabase, companyId, flowId, tableType)

  const tagged = chunks.map((c) => tagChunk(c, tableType, companyName))
  const embeddings = await embedAll(tagged.map((t) => t.embedText), openai)

  const rows = tagged.map((t, i) => ({
    company_id: companyId,
    content: t.stored,
    embedding: embeddings[i],
    metadata: { flow_id: flowId, doc_type: tableType, filename, chunk_index: i },
  }))

  const { error } = await supabase.from('documents').insert(rows)
  if (error) throw new Error(`Erro ao salvar na base: ${error.message}`)

  return { chunks: rows.length, table: 'documents' }
}

/** Processa texto estruturado diretamente (sem PDF) */
export async function processKnowledgeText(params: {
  companyId: number
  flowId: string
  filename: string
  text: string
  tableType: 'conhecimento' | 'objecoes'
  companyName?: string | null
}): Promise<{ chunks: number; table: string }> {
  const { companyId, flowId, filename, text, tableType, companyName } = params
  if (!text.trim()) throw new Error('Conteúdo vazio')

  const supabase = createServiceClient()
  const openaiKey = await resolveOpenAIKey(companyId)
  const openai = await getOpenAIClient(openaiKey)

  const chunks = chunkText(text)
  await deleteOldChunks(supabase, companyId, flowId, tableType)

  const tagged = chunks.map((c) => tagChunk(c, tableType, companyName))
  const embeddings = await embedAll(tagged.map((t) => t.embedText), openai)

  const rows = tagged.map((t, i) => ({
    company_id: companyId,
    content: t.stored,
    embedding: embeddings[i],
    metadata: { flow_id: flowId, doc_type: tableType, filename, chunk_index: i },
  }))

  const { error } = await supabase.from('documents').insert(rows)
  if (error) throw new Error(`Erro ao salvar na base: ${error.message}`)

  return { chunks: rows.length, table: 'documents' }
}
