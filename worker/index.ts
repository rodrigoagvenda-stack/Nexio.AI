/**
 * Job queue worker — runs as a separate Node.js process.
 * Polls Supabase `jobs` table every 5s, processes `process_knowledge` jobs.
 * Never imports Next.js or React — zero overlap with the web server process.
 */

import crypto from 'crypto'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

// ── Supabase ─────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('[worker] SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios')
  process.exit(1)
}

const db: SupabaseClient = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
})

// ── Crypto (réplica de lib/crypto.ts sem Next.js) ─────────────────────────────

const ALGORITHM = 'aes-256-gcm'
const KEY_LENGTH = 32
const IV_LENGTH = 16
const PLAIN_PREFIX = 'plain:'

function getKey(): Buffer | null {
  const k = process.env.ENCRYPTION_KEY
  if (!k) return null
  return crypto.scryptSync(k, 'salt', KEY_LENGTH)
}

function decrypt(encryptedData: string): string {
  if (encryptedData.startsWith(PLAIN_PREFIX)) return encryptedData.slice(PLAIN_PREFIX.length)
  const key = getKey()
  if (!key) throw new Error('ENCRYPTION_KEY necessária para descriptografar')
  const parts = encryptedData.split(':')
  if (parts.length !== 3) throw new Error('Formato de dado criptografado inválido')
  const iv = Buffer.from(parts[0], 'hex')
  const authTag = Buffer.from(parts[1], 'hex')
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  let dec = decipher.update(parts[2], 'hex', 'utf8')
  dec += decipher.final('utf8')
  return dec
}

// ── OpenAI key resolution ─────────────────────────────────────────────────────

async function resolveOpenAIKey(companyId: number): Promise<string> {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY

  try {
    const { data: cfg } = await db
      .from('sdr_configs').select('openai_key').eq('company_id', companyId).single()
    if (cfg?.openai_key) return decrypt(cfg.openai_key)
  } catch { /* fall through */ }

  try {
    const { data: rows } = await db
      .from('platform_config').select('key, value, is_encrypted').eq('key', 'openai_api_key')
    const row = rows?.[0]
    if (row?.value) return row.is_encrypted ? decrypt(row.value) : row.value
  } catch { /* fall through */ }

  throw new Error('Chave OpenAI não configurada')
}

const _openaiCache = new Map<string, OpenAI>()
async function getOpenAI(companyId: number): Promise<OpenAI> {
  const key = await resolveOpenAIKey(companyId)
  if (!_openaiCache.has(key)) _openaiCache.set(key, new OpenAI({ apiKey: key }))
  return _openaiCache.get(key)!
}

// ── Text processing ───────────────────────────────────────────────────────────

const CHUNK_SIZE = 1000
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

async function processKnowledge(payload: {
  companyId: number
  flowId: string
  filename: string
  text: string
  tableType: 'conhecimento' | 'objecoes'
}): Promise<{ chunks: number }> {
  const { companyId, flowId, filename, text, tableType } = payload
  if (!text.trim()) throw new Error('Conteúdo vazio')

  const openai = await getOpenAI(companyId)
  const chunks = chunkText(text)

  // Delete old chunks for this flow+type
  await db.from('documents').delete()
    .eq('company_id', companyId)
    .contains('metadata', { flow_id: flowId, doc_type: tableType })

  // Generate embeddings
  const res = await openai.embeddings.create({ model: 'text-embedding-3-small', input: chunks })
  const embeddings = res.data.map((d: { embedding: number[] }) => d.embedding)

  const rows = chunks.map((content, i) => ({
    company_id: companyId,
    content,
    embedding: embeddings[i],
    metadata: { flow_id: flowId, doc_type: tableType, filename, chunk_index: i },
  }))

  const { error } = await db.from('documents').insert(rows)
  if (error) throw new Error(`Erro ao salvar documentos: ${error.message}`)

  return { chunks: rows.length }
}

// ── Worker loop ───────────────────────────────────────────────────────────────

async function claimJob(): Promise<{ id: string; type: string; payload: any } | null> {
  const { data: jobs } = await db
    .from('jobs')
    .select('id, type, payload')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(1)

  const job = jobs?.[0]
  if (!job) return null

  // Atomic claim: only succeed if status is still 'pending'
  const { data: claimed } = await db
    .from('jobs')
    .update({ status: 'processing', updated_at: new Date().toISOString() })
    .eq('id', job.id)
    .eq('status', 'pending')
    .select('id')

  return claimed?.[0] ? job : null
}

async function tick() {
  const job = await claimJob()
  if (!job) return

  console.log(`[worker] processando job ${job.id} (${job.type})`)

  try {
    if (job.type === 'process_knowledge') {
      const result = await processKnowledge(job.payload)
      await db.from('jobs').update({
        status: 'done',
        updated_at: new Date().toISOString(),
      }).eq('id', job.id)
      console.log(`[worker] job ${job.id} concluído — ${result.chunks} chunks`)
    } else {
      throw new Error(`Tipo de job desconhecido: ${job.type}`)
    }
  } catch (err: any) {
    console.error(`[worker] job ${job.id} falhou:`, err.message)
    await db.from('jobs').update({
      status: 'error',
      error: err.message,
      updated_at: new Date().toISOString(),
    }).eq('id', job.id)
  }
}

async function run() {
  console.log('[worker] iniciado — polling a cada 5s')
  while (true) {
    try {
      await tick()
    } catch (err: any) {
      console.error('[worker] erro inesperado no tick:', err.message)
    }
    await new Promise((r) => setTimeout(r, 5_000))
  }
}

run()
