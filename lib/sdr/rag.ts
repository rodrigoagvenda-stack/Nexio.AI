/**
 * RAG — Upload de PDF/texto, chunking, embeddings e inserção na tabela `documents`.
 */

import { createServiceClient } from '@/lib/supabase/server'
import { getPlatformConfig } from '@/lib/platform-config'
import OpenAI from 'openai'
import { decrypt } from '@/lib/crypto'

const CHUNK_SIZE = 1000
const CHUNK_OVERLAP = 100

/** Resolve OpenAI key: sdr_configs (empresa) → platform_config (global) */
async function resolveOpenAIKey(companyId: number): Promise<string> {
  const supabase = createServiceClient()
  const { data: cfg } = await supabase
    .from('sdr_configs').select('openai_key').eq('company_id', companyId).single()
  if (cfg?.openai_key) return decrypt(cfg.openai_key)
  const platform = await getPlatformConfig()
  if (platform.openai_api_key) return platform.openai_api_key
  throw new Error('Chave OpenAI não configurada. Acesse Admin → Configurações de Plataforma e cadastre a API Key da OpenAI.')
}

/** Gera embeddings para TODOS os chunks em uma única chamada (evita timeout serial) */
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

async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>
  const data = await pdfParse(buffer)
  return data.text
}

/** Remove chunks antigos da tabela documents para company+flow+tipo */
async function deleteOldChunks(
  supabase: ReturnType<typeof createServiceClient>,
  companyId: number,
  flowId: string,
  docType: string
) {
  // Deleta chunks com metadata correspondente (novos uploads)
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
  const openai = new OpenAI({ apiKey: openaiKey })

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

/** Processa texto estruturado diretamente (sem PDF), usando o mesmo pipeline de chunking + embeddings */
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
  const openai = new OpenAI({ apiKey: openaiKey })

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
