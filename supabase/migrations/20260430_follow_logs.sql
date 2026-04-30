-- Tabela de log de disparos de follow-up
-- Usada por: follow.ts (follow_geral) e follow-antnoshow.ts (AntNoshow)
-- Deduplicação AntNoshow: UNIQUE(lead_id, momento)

CREATE TABLE IF NOT EXISTS follow_logs (
  id         BIGSERIAL PRIMARY KEY,
  lead_id    BIGINT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  company_id INT NOT NULL,
  mensagem   TEXT,
  tipo       TEXT,     -- 'follow_geral' (usado por follow.ts)
  momento    TEXT,     -- '24h_antes' | '2h_antes' | '15min_antes' | '5min_apos' (AntNoshow)
  enviado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- NULL momento é permitido (follow_geral não usa momento)
-- UNIQUE só avalia linhas onde momento IS NOT NULL (NULLs não colidem em SQL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_follow_logs_lead_momento
  ON follow_logs (lead_id, momento)
  WHERE momento IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_follow_logs_lead ON follow_logs (lead_id);
CREATE INDEX IF NOT EXISTS idx_follow_logs_company ON follow_logs (company_id);
