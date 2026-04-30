/**
 * Postgres Chat Memory — contexto de curto prazo do orquestrador.
 * Fiel ao nó Postgres Chat Memory1 do N8N:
 *   - Tabela: n8n_chat_histories
 *   - Session ID: phone (body.chat.phone)
 *   - Context Window: 10 mensagens
 */

import { Pool } from 'pg'

let pool: Pool | null = null

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30_000,
    })
    pool.on('error', (err) => console.error('[PG Memory]', err.message))
  }
  return pool
}

export interface ChatMessage {
  role: 'human' | 'ai'
  content: string
}

export async function getChatHistory(
  sessionId: string,
  windowLength = 10
): Promise<ChatMessage[]> {
  try {
    const db = getPool()
    const { rows } = await db.query<{ message: ChatMessage }>(
      `SELECT message FROM n8n_chat_histories
       WHERE session_id = $1
       ORDER BY id DESC
       LIMIT $2`,
      [sessionId, windowLength]
    )
    return rows.map((r) => r.message).reverse()
  } catch {
    return []
  }
}

export async function saveChatMessage(
  sessionId: string,
  role: 'human' | 'ai',
  content: string
): Promise<void> {
  try {
    const db = getPool()
    await db.query(
      `INSERT INTO n8n_chat_histories (session_id, message) VALUES ($1, $2)`,
      [sessionId, JSON.stringify({ role, content })]
    )
  } catch (err: any) {
    console.error('[PG Memory] saveChatMessage:', err.message)
  }
}

export async function clearChatHistory(sessionId: string): Promise<void> {
  try {
    const db = getPool()
    await db.query(`DELETE FROM n8n_chat_histories WHERE session_id = $1`, [sessionId])
  } catch { /* ok */ }
}
