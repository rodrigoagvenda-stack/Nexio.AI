-- Histórico versionado do Resumo da IA do lead. leads.resumo_ia continua
-- existindo como "o mais recente" (nada que já lê esse campo quebra);
-- essa tabela guarda um snapshot a cada atualização real (resumo_ia +
-- segment/priority/nivel_interesse juntos, no mesmo momento) pra dar pra
-- ver a evolução do lead ao longo da conversa.

CREATE TABLE IF NOT EXISTS lead_resumo_history (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  lead_id BIGINT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  resumo_ia TEXT,
  segment TEXT,
  priority TEXT,
  nivel_interesse TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_resumo_history_lead
  ON lead_resumo_history (lead_id, created_at DESC);

ALTER TABLE lead_resumo_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_company_resumo_history" ON lead_resumo_history
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE auth_user_id = auth.uid()
    )
  );
