-- ─── Billing: token tracking e franquia ──────────────────────────────────────
-- Tabelas: model_prices, plans, usage_logs, extra_packages
-- + colunas de alerta em companies

-- ── 1. model_prices ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS model_prices (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model       TEXT NOT NULL,
  input_price  NUMERIC(10,4) NOT NULL,  -- USD por 1M tokens de input
  output_price NUMERIC(10,4) NOT NULL,  -- USD por 1M tokens de output
  active      BOOLEAN NOT NULL DEFAULT true,
  valid_from  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS model_prices_model_active_idx ON model_prices (model, active, valid_from DESC);

-- Seed: preços OpenAI (USD por 1M tokens)
INSERT INTO model_prices (model, input_price, output_price, valid_from) VALUES
  ('gpt-4.1',            2.00,  8.00,  NOW()),
  ('gpt-4.1-mini',       0.40,  1.60,  NOW()),
  ('text-embedding-3-small', 0.02, 0.00, NOW())
ON CONFLICT DO NOTHING;

-- ── 2. plans ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS plans (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL UNIQUE,  -- matches companies.plan_type
  monthly_price  NUMERIC(10,2) NOT NULL,
  token_quota    BIGINT NOT NULL,
  overage_markup NUMERIC(5,4) NOT NULL DEFAULT 1.5000,  -- multiplicador sobre cost_usd
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO plans (name, monthly_price, token_quota, overage_markup) VALUES
  ('basic',   0.00,    50000,   1.5000),
  ('starter', 1600.00, 500000,  1.5000),
  ('pro',     2000.00, 1000000, 1.5000),
  ('scale',   2600.00, 2000000, 1.5000)
ON CONFLICT (name) DO UPDATE
  SET monthly_price = EXCLUDED.monthly_price,
      token_quota   = EXCLUDED.token_quota;

-- ── 3. usage_logs ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS usage_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  agent             TEXT NOT NULL,   -- 'orchestrator', 'pipeline', 'segmentacao', etc.
  model             TEXT NOT NULL,   -- valor de response.model (nunca hardcoded)
  prompt_tokens     INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens      INTEGER NOT NULL DEFAULT 0,
  cost_usd          NUMERIC(14,8) NOT NULL DEFAULT 0,
  model_price_id    UUID REFERENCES model_prices(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS usage_logs_tenant_month_idx
  ON usage_logs (tenant_id, created_at DESC);

-- ── 4. extra_packages ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS extra_packages (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  tokens_granted BIGINT NOT NULL,
  tokens_used    BIGINT NOT NULL DEFAULT 0,
  paid_amount    NUMERIC(10,2) NOT NULL,
  valid_until    TIMESTAMPTZ NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS extra_packages_tenant_valid_idx
  ON extra_packages (tenant_id, valid_until);

-- ── 5. Alert tracking em companies ───────────────────────────────────────────
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS token_alert_80_sent_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS token_alert_95_sent_at  TIMESTAMPTZ;

-- ── RLS: usage_logs e extra_packages visíveis apenas para a própria empresa ──
ALTER TABLE usage_logs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE extra_packages  ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "usage_logs_own_company"
  ON usage_logs FOR ALL
  USING (
    tenant_id IN (
      SELECT company_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY IF NOT EXISTS "extra_packages_own_company"
  ON extra_packages FOR ALL
  USING (
    tenant_id IN (
      SELECT company_id FROM users WHERE auth_user_id = auth.uid()
    )
  );
