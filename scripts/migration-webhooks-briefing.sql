-- =====================================================
-- MIGRATION: Webhooks por empresa + Briefing multi-tenant
-- Execute este script no Supabase SQL Editor
-- =====================================================

-- -----------------------------------------------------
-- FASE 1: Webhooks por empresa
-- -----------------------------------------------------

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS webhook_maps_url TEXT,
  ADD COLUMN IF NOT EXISTS webhook_whatsapp_url TEXT;

-- -----------------------------------------------------
-- FASE 2: Briefing multi-tenant
-- -----------------------------------------------------

-- Configuração de briefing por empresa
CREATE TABLE IF NOT EXISTS briefing_company_config (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT FALSE,
  primary_color TEXT DEFAULT '#7c3aed',
  logo_url TEXT,
  title TEXT DEFAULT 'Preencha seu briefing',
  description TEXT,
  webhook_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_company_briefing UNIQUE (company_id)
);

-- Perguntas customizadas do briefing por empresa
CREATE TABLE IF NOT EXISTS briefing_questions (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  field_key TEXT NOT NULL,
  question_type TEXT NOT NULL DEFAULT 'text',
  -- 'text' | 'textarea' | 'select' | 'multiselect' | 'radio' | 'checkbox'
  options JSONB,
  is_required BOOLEAN DEFAULT FALSE,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_field_per_company UNIQUE (company_id, field_key)
);

-- Respostas de briefing por empresa
CREATE TABLE IF NOT EXISTS briefing_responses (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  answers JSONB NOT NULL,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  webhook_sent BOOLEAN DEFAULT FALSE,
  webhook_sent_at TIMESTAMPTZ
);

-- Trigger updated_at para briefing_company_config
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ language 'plpgsql';

CREATE TRIGGER update_briefing_company_config_updated_at
  BEFORE UPDATE ON briefing_company_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS: acesso público para leitura de briefing (formulário público)
ALTER TABLE briefing_company_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE briefing_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE briefing_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "briefing_config_public_read" ON briefing_company_config
  FOR SELECT USING (is_active = true);

CREATE POLICY "briefing_config_service_all" ON briefing_company_config
  FOR ALL USING (true);

CREATE POLICY "briefing_questions_public_read" ON briefing_questions
  FOR SELECT USING (true);

CREATE POLICY "briefing_questions_service_all" ON briefing_questions
  FOR ALL USING (true);

CREATE POLICY "briefing_responses_service_all" ON briefing_responses
  FOR ALL USING (true);

-- Verificar resultado
SELECT 'companies' as tabela,
  column_name, data_type
FROM information_schema.columns
WHERE table_name = 'companies'
  AND column_name IN ('webhook_maps_url', 'webhook_whatsapp_url');

SELECT 'briefing_company_config' as tabela, COUNT(*) FROM briefing_company_config;
SELECT 'briefing_questions' as tabela, COUNT(*) FROM briefing_questions;
SELECT 'briefing_responses' as tabela, COUNT(*) FROM briefing_responses;
