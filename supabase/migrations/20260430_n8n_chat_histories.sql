-- Roda no PostgreSQL do EasyPanel (nexio-ai_postgres-zaapli), NÃO no Supabase.
-- Contexto de curto prazo do orquestrador SDR — fiel ao nó Postgres Chat Memory1 do N8N.

CREATE TABLE IF NOT EXISTS n8n_chat_histories (
  id         BIGSERIAL PRIMARY KEY,
  session_id TEXT NOT NULL,      -- phone number (body.chat.phone)
  message    JSONB NOT NULL,     -- { role: 'human'|'ai', content: '...' }
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_n8n_chat_session ON n8n_chat_histories (session_id, id);
