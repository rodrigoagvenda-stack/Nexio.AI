-- Canvas multi-flow: allow multiple sequences per category (tipo)
-- Previously, one sequence per tipo was enforced in the UI (not DB).
-- Now each tipo acts as a category, and companies can have N flows per category.

-- 1. Add display name column so each flow can have a unique name within its category
ALTER TABLE follow_sequences
  ADD COLUMN IF NOT EXISTS display_name text;

-- 2. Backfill display_name from existing nome
UPDATE follow_sequences SET display_name = nome WHERE display_name IS NULL;

-- 3. Remove old unique constraint on (company_id, tipo) if it exists
-- (it was only enforced by the UI, not the DB, so this is a no-op but safe)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'follow_sequences_company_id_tipo_key'
  ) THEN
    ALTER TABLE follow_sequences DROP CONSTRAINT follow_sequences_company_id_tipo_key;
  END IF;
END $$;

-- 4. Extend eventoEntrada enum in canvas_config to support all payment events
-- (These are stored as JSONB so no enum change needed, just documenting)
-- eventoEntrada values: novo_lead | mudanca_status | webhook | mercadopago | kiwify | mp_kiwify
--                       | asaas_pago | asaas_boleto_gerado | asaas_boleto_vencido
--                       | asaas_checkout_viewed | asaas_overdue | asaas_refunded
--                       | asaas_subscription_created | asaas_subscription_deleted

-- 5. Add lead_charges table for tracking charges generated from within Zaapply
CREATE TABLE IF NOT EXISTS lead_charges (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  bigint NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  lead_id     bigint NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  platform    text NOT NULL CHECK (platform IN ('asaas', 'mercadopago', 'kiwify')),
  external_id text,          -- payment ID from the platform (e.g. Asaas pay_xxx)
  amount      numeric(10,2) NOT NULL,
  description text,
  billing_type text,         -- BOLETO | PIX | CREDIT_CARD | UNDEFINED
  due_date    date,
  status      text DEFAULT 'pending',  -- pending | received | confirmed | overdue | refunded | cancelled
  payment_url text,          -- link to pay
  invoice_url text,          -- boleto PDF URL
  pix_payload jsonb,         -- { encodedImage, payload, expirationDate }
  paid_at     timestamptz,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lead_charges_company_id_idx ON lead_charges(company_id);
CREATE INDEX IF NOT EXISTS lead_charges_lead_id_idx ON lead_charges(lead_id);
CREATE INDEX IF NOT EXISTS lead_charges_external_id_idx ON lead_charges(external_id) WHERE external_id IS NOT NULL;

-- Enable RLS
ALTER TABLE lead_charges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_isolation" ON lead_charges
  FOR ALL USING (
    company_id = (
      SELECT company_id FROM user_profiles
      WHERE user_id = auth.uid()
      LIMIT 1
    )
  );
