/**
 * RAG — Upload de PDF, extração de texto, chunking, embeddings e inserção no Supabase Vector.
 * Seção 9 do PRD.
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

export async function processKnowledgePdf(params: {
  companyId: number
  flowId: string
  filename: string
  fileBuffer: Buffer
  tableType: 'conhecimento' | 'objecoes'
}): Promise<{ chunks: number; table: string }> {
  const { companyId, flowId, filename, fileBuffer, tableType } = params
  const supabase = createServiceClient()

  const [openaiKey, flow] = await Promise.all([
    resolveOpenAIKey(companyId),
    supabase.from('sdr_flows')
      .select('vector_table_conhecimento, vector_table_objecoes')
      .eq('id', flowId).eq('company_id', companyId).single()
      .then((r) => r.data),
  ])
  if (!flow) throw new Error('Fluxo não encontrado')

  const openai = new OpenAI({ apiKey: openaiKey })
  const updateField = tableType === 'conhecimento' ? 'vector_table_conhecimento' : 'vector_table_objecoes'
  const tableName = flow[updateField] ?? `nexio_${tableType === 'conhecimento' ? 'conhecimento' : 'objecoes'}_${companyId}`
  if (!flow[updateField]) {
    await supabase.from('sdr_flows').update({ [updateField]: tableName }).eq('id', flowId)
  }

  const rawText = await extractTextFromPdf(fileBuffer)
  if (!rawText.trim()) throw new Error('PDF sem texto extraível')

  const chunks = chunkText(rawText)

  await supabase.from('rag_documents').delete()
    .eq('company_id', companyId).eq('flow_id', flowId).eq('table_name', tableName)

  // Uma única chamada de embeddings para todos os chunks
  const embeddings = await embedAll(chunks, openai)

  const rows = chunks.map((content, i) => ({
    company_id: companyId, flow_id: flowId, filename, table_name: tableName,
    chunk_index: i, content, embedding: embeddings[i],
  }))

  const { error } = await supabase.from('rag_documents').insert(rows)
  if (error) {
    if (error.code === '42P01') throw new Error('Tabela rag_documents não existe. Execute a migration 20260505000000_rag_documents.sql no Supabase.')
    throw error
  }

  return { chunks: rows.length, table: tableName }
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

  const [openaiKey, flow] = await Promise.all([
    resolveOpenAIKey(companyId),
    supabase.from('sdr_flows')
      .select('vector_table_conhecimento, vector_table_objecoes')
      .eq('id', flowId).eq('company_id', companyId).single()
      .then((r) => r.data),
  ])
  if (!flow) throw new Error('Fluxo não encontrado')

  const openai = new OpenAI({ apiKey: openaiKey })
  const updateField = tableType === 'conhecimento' ? 'vector_table_conhecimento' : 'vector_table_objecoes'
  const tableName = flow[updateField] ?? `nexio_${tableType === 'conhecimento' ? 'conhecimento' : 'objecoes'}_${companyId}`
  if (!flow[updateField]) {
    await supabase.from('sdr_flows').update({ [updateField]: tableName }).eq('id', flowId)
  }

  const chunks = chunkText(text)

  await supabase.from('rag_documents').delete()
    .eq('company_id', companyId).eq('flow_id', flowId).eq('table_name', tableName)

  // Uma única chamada de embeddings para todos os chunks (sem loop serial → sem timeout)
  const embeddings = await embedAll(chunks, openai)

  const rows = chunks.map((content, i) => ({
    company_id: companyId, flow_id: flowId, filename, table_name: tableName,
    chunk_index: i, content, embedding: embeddings[i],
  }))

  const { error } = await supabase.from('rag_documents').insert(rows)
  if (error) {
    if (error.code === '42P01') throw new Error('Tabela rag_documents não existe. Execute a migration 20260505000000_rag_documents.sql no Supabase.')
    throw error
  }

  return { chunks: rows.length, table: tableName }
}
