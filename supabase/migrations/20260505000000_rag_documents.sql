-- ─── RAG Documents — base vetorial para Base de Conhecimento + Objeções ──────
-- Requer a extensão pgvector (habilite em Database → Extensions no Supabase)

-- Extensão pgvector (idempotente)
CREATE EXTENSION IF NOT EXISTS vector;

-- Tabela principal de chunks vetorizados
CREATE TABLE IF NOT EXISTS rag_documents (
  id           BIGSERIAL PRIMARY KEY,
  company_id   BIGINT       NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  flow_id      UUID         NOT NULL REFERENCES sdr_flows(id) ON DELETE CASCADE,
  filename     TEXT         NOT NULL,
  table_name   TEXT         NOT NULL,          -- ex: 'nexio_conhecimento_7'
  chunk_index  INTEGER      NOT NULL DEFAULT 0,
  content      TEXT         NOT NULL,
  embedding    VECTOR(1536),                    -- text-embedding-3-small (1536 dims)
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  UNIQUE (company_id, flow_id, table_name, chunk_index)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_rag_documents_company_flow
  ON rag_documents (company_id, flow_id);

CREATE INDEX IF NOT EXISTS idx_rag_documents_table_name
  ON rag_documents (table_name);

-- Índice vetorial ANN (IVFFlat — ótimo para 10k–1M vetores)
-- Cria após inserir dados: CREATE INDEX CONCURRENTLY ... (pode rodar manualmente depois)
-- Aqui deixamos o índice exato (brute-force) para funcionar desde o início
-- sem precisar de VACUUM/treinamento:
CREATE INDEX IF NOT EXISTS idx_rag_documents_embedding
  ON rag_documents USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 10);

-- RLS: usuário só acessa docs da própria empresa
ALTER TABLE rag_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_isolation_rag_documents" ON rag_documents
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

-- Função utilitária: busca semântica por similaridade de cosseno
-- Uso: SELECT * FROM search_rag(7, '...flow-id...', '[0.1,0.2,...]'::vector, 5)
CREATE OR REPLACE FUNCTION search_rag(
  p_company_id BIGINT,
  p_flow_id    UUID,
  p_embedding  VECTOR(1536),
  p_limit      INT DEFAULT 5
)
RETURNS TABLE (
  id          BIGINT,
  content     TEXT,
  table_name  TEXT,
  similarity  FLOAT
)
LANGUAGE sql STABLE AS $$
  SELECT
    id,
    content,
    table_name,
    1 - (embedding <=> p_embedding) AS similarity
  FROM rag_documents
  WHERE company_id = p_company_id
    AND flow_id    = p_flow_id
    AND embedding  IS NOT NULL
  ORDER BY embedding <=> p_embedding
  LIMIT p_limit;
$$;
