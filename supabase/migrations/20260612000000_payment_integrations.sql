-- Payment integrations: armazena credenciais de MP e Kiwify por empresa
CREATE TABLE IF NOT EXISTS payment_integrations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  platform      TEXT NOT NULL CHECK (platform IN ('mercadopago', 'kiwify')),
  config        JSONB NOT NULL DEFAULT '{}',
  active        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, platform)
);

ALTER TABLE payment_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_integrations_company_isolation" ON payment_integrations
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

-- Índice para lookup rápido no webhook handler (companyId + platform)
CREATE INDEX IF NOT EXISTS idx_payment_integrations_lookup
  ON payment_integrations(company_id, platform, active);

NOTIFY pgrst, 'reload schema';
