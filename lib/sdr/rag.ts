/**
 * RAG — Upload de PDF, extração de texto, chunking, embeddings e inserção no Supabase Vector.
 * Seção 9 do PRD.
 */

import { createServiceClient } from '@/lib/supabase/server'
import OpenAI from 'openai'
import { decrypt } from '@/lib/crypto'

const CHUNK_SIZE = 1000  // caracteres por chunk
const CHUNK_OVERLAP = 100

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

  // Busca config openai
  const { data: cfg } = await supabase
    .from('sdr_configs')
    .select('openai_key')
    .eq('company_id', companyId)
    .single()

  const openaiKey = cfg?.openai_key ? decrypt(cfg.openai_key) : process.env.OPENAI_API_KEY ?? ''
  const openai = new OpenAI({ apiKey: openaiKey })

  // Busca nome da tabela vector do fluxo
  const { data: flow } = await supabase
    .from('sdr_flows')
    .select('vector_table_conhecimento, vector_table_objecoes')
    .eq('id', flowId)
    .eq('company_id', companyId)
    .single()

  if (!flow) throw new Error('Fluxo não encontrado')

  const tableName = tableType === 'conhecimento'
    ? (flow.vector_table_conhecimento ?? `nexio_conhecimento_${companyId}`)
    : (flow.vector_table_objecoes ?? `nexio_objecoes_${companyId}`)

  // Salva o nome da tabela no fluxo se ainda não estava
  const updateField = tableType === 'conhecimento' ? 'vector_table_conhecimento' : 'vector_table_objecoes'
  if (!flow[updateField === 'vector_table_conhecimento' ? 'vector_table_conhecimento' : 'vector_table_objecoes']) {
    await supabase.from('sdr_flows').update({ [updateField]: tableName }).eq('id', flowId)
  }

  // Extrai texto
  const rawText = await extractTextFromPdf(fileBuffer)
  if (!rawText.trim()) throw new Error('PDF sem texto extraível')

  // Chunking
  const chunks = chunkText(rawText)

  // Remove chunks anteriores do mesmo arquivo nesta tabela
  await supabase
    .from('rag_documents')
    .delete()
    .eq('company_id', companyId)
    .eq('flow_id', flowId)
    .eq('filename', filename)
    .eq('table_name', tableName)

  // Gera embeddings em lotes de 20
  const batchSize = 20
  let insertedCount = 0

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize)

    const embRes = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: batch,
    })

    const rows = batch.map((content, j) => ({
      company_id: companyId,
      flow_id: flowId,
      filename,
      table_name: tableName,
      chunk_index: i + j,
      content,
      embedding: embRes.data[j].embedding,
    }))

    const { error } = await supabase.from('rag_documents').insert(rows)
    if (error) throw error
    insertedCount += batch.length
  }

  return { chunks: insertedCount, table: tableName }
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
  const supabase = createServiceClient()

  const { data: cfg } = await supabase
    .from('sdr_configs')
    .select('openai_key')
    .eq('company_id', companyId)
    .single()

  const openaiKey = cfg?.openai_key ? decrypt(cfg.openai_key) : process.env.OPENAI_API_KEY ?? ''
  const openai = new OpenAI({ apiKey: openaiKey })

  const { data: flow } = await supabase
    .from('sdr_flows')
    .select('vector_table_conhecimento, vector_table_objecoes')
    .eq('id', flowId)
    .eq('company_id', companyId)
    .single()

  if (!flow) throw new Error('Fluxo não encontrado')

  const tableName = tableType === 'conhecimento'
    ? (flow.vector_table_conhecimento ?? `nexio_conhecimento_${companyId}`)
    : (flow.vector_table_objecoes ?? `nexio_objecoes_${companyId}`)

  const updateField = tableType === 'conhecimento' ? 'vector_table_conhecimento' : 'vector_table_objecoes'
  if (!flow[updateField]) {
    await supabase.from('sdr_flows').update({ [updateField]: tableName }).eq('id', flowId)
  }

  if (!text.trim()) throw new Error('Conteúdo vazio')

  const chunks = chunkText(text)

  await supabase
    .from('rag_documents')
    .delete()
    .eq('company_id', companyId)
    .eq('flow_id', flowId)
    .eq('filename', filename)
    .eq('table_name', tableName)

  const batchSize = 20
  let insertedCount = 0

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize)
    const embRes = await openai.embeddings.create({ model: 'text-embedding-3-small', input: batch })
    const rows = batch.map((content, j) => ({
      company_id: companyId,
      flow_id: flowId,
      filename,
      table_name: tableName,
      chunk_index: i + j,
      content,
      embedding: embRes.data[j].embedding,
    }))
    const { error } = await supabase.from('rag_documents').insert(rows)
    if (error) throw error
    insertedCount += batch.length
  }

  return { chunks: insertedCount, table: tableName }
}
