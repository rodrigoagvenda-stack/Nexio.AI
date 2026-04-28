-- ============================================================================
-- MIGRAÇÃO MULTI-TENANT — Zaapli
-- Executar no Supabase SQL Editor
-- ============================================================================

-- 1. Colunas faltando em companies
ALTER TABLE companies ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS n8n_webhook_url TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS agente_ativo BOOLEAN DEFAULT FALSE;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS whatsapp_instance_name TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS tokens_used INTEGER DEFAULT 0;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS tokens_limit INTEGER DEFAULT 5000000;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS tokens_reset_at TIMESTAMPTZ DEFAULT NOW();

-- Normalizar plan_type para Zaapli
-- 'starter' | 'pro' | 'scale'
-- (mantém retrocompatibilidade com valores antigos)

-- 2. Coluna role em users (company_admin | company_user)
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'company_user';

-- 3. Tabela google_integrations — OAuth por empresa
CREATE TABLE IF NOT EXISTS google_integrations (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  access_token TEXT,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  scope TEXT,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id)
);

-- 4. Tabela follow_up_config — timing configurável por empresa/nicho
CREATE TABLE IF NOT EXISTS follow_up_config (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  nicho TEXT NOT NULL DEFAULT 'default',
  dias INTEGER[] NOT NULL DEFAULT '{1,3,7,14}',
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, nicho)
);

-- 5. Tabela tokens_usage — log de consumo por empresa
CREATE TABLE IF NOT EXISTS tokens_usage (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  tokens INTEGER NOT NULL,
  model TEXT,
  context TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- RLS — google_integrations
-- ============================================================================
ALTER TABLE google_integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_google_integration" ON google_integrations;
DROP POLICY IF EXISTS "service_role_all_google" ON google_integrations;
CREATE POLICY "users_own_google_integration" ON google_integrations
  FOR ALL USING (
    company_id = (SELECT company_id FROM users WHERE auth_user_id = auth.uid())
  );
CREATE POLICY "service_role_all_google" ON google_integrations
  FOR ALL USING (true);

-- ============================================================================
-- RLS — follow_up_config
-- ============================================================================
ALTER TABLE follow_up_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_follow_config" ON follow_up_config;
DROP POLICY IF EXISTS "service_role_all_follow" ON follow_up_config;
CREATE POLICY "users_own_follow_config" ON follow_up_config
  FOR ALL USING (
    company_id = (SELECT company_id FROM users WHERE auth_user_id = auth.uid())
  );
CREATE POLICY "service_role_all_follow" ON follow_up_config
  FOR ALL USING (true);

-- ============================================================================
-- RLS — tokens_usage
-- ============================================================================
ALTER TABLE tokens_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_tokens" ON tokens_usage;
DROP POLICY IF EXISTS "service_role_all_tokens" ON tokens_usage;
CREATE POLICY "users_own_tokens" ON tokens_usage
  FOR SELECT USING (
    company_id = (SELECT company_id FROM users WHERE auth_user_id = auth.uid())
  );
CREATE POLICY "service_role_all_tokens" ON tokens_usage
  FOR ALL USING (true);

-- ============================================================================
-- Índices
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_google_integrations_company ON google_integrations(company_id);
CREATE INDEX IF NOT EXISTS idx_follow_up_config_company ON follow_up_config(company_id);
CREATE INDEX IF NOT EXISTS idx_tokens_usage_company ON tokens_usage(company_id);
CREATE INDEX IF NOT EXISTS idx_tokens_usage_created ON tokens_usage(created_at);
CREATE INDEX IF NOT EXISTS idx_companies_instance_name ON companies(whatsapp_instance_name);
