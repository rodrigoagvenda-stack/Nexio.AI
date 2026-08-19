-- Peça B do plano "máquina de vendas completa": dado de gasto por anúncio da
-- Marketing API, pra calcular CAC real (não só custo por conversa). raw jsonb
-- guarda a resposta bruta de 'actions' -- os nomes exatos dos campos de
-- conversa/profundidade da Meta não são documentados, só descobertos
-- inspecionando uma resposta real contra uma conta ao vivo.
CREATE TABLE IF NOT EXISTS meta_ad_insights (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  ad_id          TEXT NOT NULL,
  ad_name        TEXT,
  campaign_id    TEXT,
  campaign_name  TEXT,
  date           DATE NOT NULL,
  spend_cents    BIGINT NOT NULL DEFAULT 0,
  impressions    BIGINT NOT NULL DEFAULT 0,
  clicks         BIGINT NOT NULL DEFAULT 0,
  raw            JSONB,
  fetched_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, ad_id, date)
);

CREATE INDEX IF NOT EXISTS idx_meta_ad_insights_company_date ON meta_ad_insights (company_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_meta_ad_insights_ad ON meta_ad_insights (company_id, ad_id);

ALTER TABLE meta_ad_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "meta_ad_insights_isolation" ON meta_ad_insights
  USING (company_id = (SELECT company_id FROM users WHERE auth_user_id = auth.uid() LIMIT 1));
