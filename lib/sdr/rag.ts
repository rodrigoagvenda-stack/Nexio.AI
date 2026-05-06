/**
 * RAG — Upload de PDF/texto, chunking, embeddings e inserção na tabela `documents`.
 *
 * Módulos pesados são lazy:
 *   - OpenAI: await import('openai') dentro de cada função (não no topo do módulo)
 *   - pdf-parse / pdfjs-dist: isolados em lib/pdf-extractor.ts + serverExternalPackages
 */

import { createServiceClient } from '@/lib/supabase/server'
import { getPlatformConfig } from '@/lib/platform-config'
import { decrypt } from '@/lib/crypto'
import type OpenAI from 'openai'  // type-only: apagado em compile-time, sem impacto no bundle

// Cache compartilhado por API key — evita criar instâncias duplicadas entre chamadas
const _openaiCache = new Map<string, OpenAI>()
async function getOpenAIClient(apiKey: string): Promise<OpenAI> {
  if (!_openaiCache.has(apiKey)) {
    const { default: OpenAIClass } = await import('openai')
    _openaiCache.set(apiKey, new OpenAIClass({ apiKey }))
  }
  return _openaiCache.get(apiKey)!
}

const CHUNK_SIZE = 1000
const CHUNK_OVERLAP = 100

/** Resolve OpenAI key: env var → sdr_configs (empresa) → platform_config (global) */
async function resolveOpenAIKey(companyId: number): Promise<string> {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY

  try {
    const supabase = createServiceClient()
    const { data: cfg } = await supabase
      .from('sdr_configs').select('openai_key').eq('company_id', companyId).single()
    if (cfg?.openai_key) return decrypt(cfg.openai_key)
  } catch { /* ignora — tenta platform_config */ }

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

function chunkText(text: string): string[] {
  const chunks: string[] = []
  let start = 0
  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length)
    chunks.push(text.slice(start, end).trim())
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
}): Promise<{ chunks: number; table: string }> {
  const { companyId, flowId, filename, fileBuffer, tableType } = params
  const supabase = createServiceClient()

  const openaiKey = await resolveOpenAIKey(companyId)
  const openai = await getOpenAIClient(openaiKey)

  // Lazy import — pdf-parse/pdfjs-dist só carregam para uploads de PDF
  const { extractTextFromPdf } = await import('@/lib/pdf-extractor')
  const rawText = await extractTextFromPdf(fileBuffer)
  if (!rawText.trim()) throw new Error('PDF sem texto extraível')

  const chunks = chunkText(rawText)
  await deleteOldChunks(supabase, companyId, flowId, tableType)

  const embeddings = await embedAll(chunks, openai)

  const rows = chunks.map((content, i) => ({
    company_id: companyId,
    content,
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
}): Promise<{ chunks: number; table: string }> {
  const { companyId, flowId, filename, text, tableType } = params
  if (!text.trim()) throw new Error('Conteúdo vazio')

  const supabase = createServiceClient()
  const openaiKey = await resolveOpenAIKey(companyId)
  const openai = await getOpenAIClient(openaiKey)

  const chunks = chunkText(text)
  await deleteOldChunks(supabase, companyId, flowId, tableType)

  const embeddings = await embedAll(chunks, openai)

  const rows = chunks.map((content, i) => ({
    company_id: companyId,
    content,
    embedding: embeddings[i],
    metadata: { flow_id: flowId, doc_type: tableType, filename, chunk_index: i },
  }))

  const { error } = await supabase.from('documents').insert(rows)
  if (error) throw new Error(`Erro ao salvar na base: ${error.message}`)

  return { chunks: rows.length, table: 'documents' }
}
