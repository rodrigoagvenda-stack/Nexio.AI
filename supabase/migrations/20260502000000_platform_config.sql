-- Tabela de configurações globais da plataforma
-- Editável via Admin → Configurações sem precisar de redeploy
-- Valores sensíveis são criptografados pela lib/crypto.ts (ENCRYPTION_KEY)

CREATE TABLE IF NOT EXISTS platform_config (
  key          TEXT PRIMARY KEY,
  value        TEXT NOT NULL DEFAULT '',
  is_encrypted BOOLEAN NOT NULL DEFAULT false,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Apenas service_role acessa (sem RLS pública)
ALTER TABLE platform_config ENABLE ROW LEVEL SECURITY;

-- Seed inicial com chaves vazias — admin preenche via painel
INSERT INTO platform_config (key, value, is_encrypted) VALUES
  ('openai_api_key',        '',                                    true),
  ('uazapi_base_url',       '',                                    false),
  ('uazapi_admin_token',    '',                                    true),
  ('google_client_id',      '',                                    false),
  ('google_client_secret',  '',                                    true),
  ('stripe_secret_key',     '',                                    true),
  ('stripe_webhook_secret', '',                                    true),
  ('stripe_price_starter',  '',                                    false),
  ('stripe_price_pro',      '',                                    false),
  ('stripe_price_scale',    '',                                    false),
  ('asaas_api_key',         '',                                    true),
  ('asaas_base_url',        'https://api-sandbox.asaas.com/v3',   false),
  ('asaas_webhook_token',   '',                                    true)
ON CONFLICT (key) DO NOTHING;
