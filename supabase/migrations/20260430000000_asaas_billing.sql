-- ─── Asaas Billing: colunas em companies + tabela de cobranças extras ────────

-- Colunas de integração Asaas em companies
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS asaas_customer_id     TEXT,
  ADD COLUMN IF NOT EXISTS asaas_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS asaas_cpf_cnpj        TEXT,
  ADD COLUMN IF NOT EXISTS subscription_start_date TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS companies_asaas_customer_idx ON companies (asaas_customer_id);

-- Tabela de cobranças PIX para pacotes extras (controla o ciclo pending→confirmed)
CREATE TABLE IF NOT EXISTS extra_package_charges (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  asaas_payment_id TEXT UNIQUE,
  tokens_to_grant  BIGINT NOT NULL,
  amount           NUMERIC(10,2) NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending',  -- pending | confirmed | overdue | cancelled
  pix_payload      JSONB,       -- qrcode, copy-paste, expiration etc
  valid_until      TIMESTAMPTZ NOT NULL,  -- fim do ciclo mensal atual do tenant
  confirmed_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS extra_package_charges_tenant_idx   ON extra_package_charges (tenant_id);
CREATE INDEX IF NOT EXISTS extra_package_charges_asaas_id_idx ON extra_package_charges (asaas_payment_id);

-- RLS: visible apenas para a própria empresa
ALTER TABLE extra_package_charges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "extra_package_charges_own_company" ON extra_package_charges;
CREATE POLICY "extra_package_charges_own_company"
  ON extra_package_charges FOR ALL
  USING (
    tenant_id IN (
      SELECT company_id FROM users WHERE auth_user_id = auth.uid()
    )
  );
