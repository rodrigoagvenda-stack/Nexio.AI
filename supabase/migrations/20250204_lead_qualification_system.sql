-- ============================================================================
-- SISTEMA DE QUALIFICAÇÃO DE LEADS NEXIO AI
-- Migration: 20250204_lead_qualification_system.sql
-- ============================================================================

-- ============================================================================
-- 1. TABELA briefing_config (se não existir)
-- ============================================================================
CREATE TABLE IF NOT EXISTS briefing_config (
  id SERIAL PRIMARY KEY,
  webhook_url TEXT,
  webhook_secret TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  last_test_at TIMESTAMPTZ,
  last_test_status TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 2. TABELA briefing_responses (se não existir)
-- ============================================================================
CREATE TABLE IF NOT EXISTS briefing_responses (
  id BIGSERIAL PRIMARY KEY,
  nome_responsavel TEXT NOT NULL,
  email TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  country_code TEXT DEFAULT '+55',
  nome_empresa TEXT NOT NULL,
  site TEXT,
  instagram TEXT,
  segmento TEXT NOT NULL,
  tempo_mercado TEXT NOT NULL,
  investe_marketing TEXT NOT NULL,
  resultados TEXT,
  objetivo TEXT,
  faturamento TEXT NOT NULL,
  budget TEXT NOT NULL,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  webhook_sent BOOLEAN DEFAULT FALSE,
  webhook_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 3. TABELA lead_qualification_config (configuração do webhook)
-- ============================================================================
CREATE TABLE IF NOT EXISTS lead_qualification_config (
  id SERIAL PRIMARY KEY,
  webhook_url TEXT,
  webhook_secret TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  last_test_at TIMESTAMPTZ,
  last_test_status TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 4. TABELA lead_qualification_responses (novo formulário de captação)
-- ============================================================================
CREATE TABLE IF NOT EXISTS lead_qualification_responses (
  id BIGSERIAL PRIMARY KEY,

  -- Informações Básicas
  nome_completo TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  country_code TEXT DEFAULT '+55',
  email TEXT NOT NULL,
  nome_empresa TEXT NOT NULL,

  -- Qualificação do Negócio
  segmento_negocio TEXT NOT NULL,
  volume_atendimentos TEXT NOT NULL, -- 'menos_20', '20_50', '50_100', 'mais_100'

  -- Identificação do Gargalo
  principal_gargalo TEXT NOT NULL, -- 'demora_resposta', 'perda_leads', 'equipe_sobrecarregada', 'falta_organizacao', 'dificuldade_qualificar', 'nao_acompanha_funil', 'outro'
  dor_principal TEXT, -- campo aberto

  -- Maturidade Comercial
  processo_vendas TEXT NOT NULL, -- 'sim_estruturado', 'sim_informal', 'nao'
  ticket_medio TEXT,
  pessoas_comercial TEXT,

  -- Urgência e Budget
  urgencia TEXT NOT NULL, -- 'urgente', 'curto_prazo', 'pesquisando'
  budget TEXT NOT NULL, -- '3000_5000', '5000_8000', 'acima_8000', 'preciso_entender_roi'

  -- Meta
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  webhook_sent BOOLEAN DEFAULT FALSE,
  webhook_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 5. TABELA n8n_webhook_config (se não existir)
-- ============================================================================
CREATE TABLE IF NOT EXISTS n8n_webhook_config (
  id SERIAL PRIMARY KEY,
  webhook_type TEXT NOT NULL UNIQUE,
  webhook_url TEXT NOT NULL,
  auth_type TEXT DEFAULT 'basic',
  auth_username TEXT,
  auth_password TEXT,
  auth_token TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 6. ÍNDICES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_briefing_responses_created_at ON briefing_responses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_briefing_responses_email ON briefing_responses(email);
CREATE INDEX IF NOT EXISTS idx_briefing_responses_whatsapp ON briefing_responses(whatsapp);

CREATE INDEX IF NOT EXISTS idx_lead_qualification_responses_created_at ON lead_qualification_responses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_qualification_responses_email ON lead_qualification_responses(email);
CREATE INDEX IF NOT EXISTS idx_lead_qualification_responses_whatsapp ON lead_qualification_responses(whatsapp);

CREATE INDEX IF NOT EXISTS idx_n8n_webhook_config_type ON n8n_webhook_config(webhook_type);

-- ============================================================================
-- 7. RLS (Row Level Security)
-- ============================================================================
ALTER TABLE briefing_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE briefing_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_qualification_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_qualification_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE n8n_webhook_config ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 8. POLÍTICAS RLS - briefing_config
-- ============================================================================
DROP POLICY IF EXISTS "briefing_config_service_all" ON briefing_config;
CREATE POLICY "briefing_config_service_all" ON briefing_config FOR ALL USING (true);

-- ============================================================================
-- 9. POLÍTICAS RLS - briefing_responses
-- ============================================================================
DROP POLICY IF EXISTS "briefing_responses_public_insert" ON briefing_responses;
DROP POLICY IF EXISTS "briefing_responses_admin_select" ON briefing_responses;
DROP POLICY IF EXISTS "briefing_responses_service_all" ON briefing_responses;

-- Service role pode fazer tudo
CREATE POLICY "briefing_responses_service_all" ON briefing_responses FOR ALL USING (true);

-- ============================================================================
-- 10. POLÍTICAS RLS - lead_qualification_config
-- ============================================================================
DROP POLICY IF EXISTS "lead_qualification_config_service_all" ON lead_qualification_config;
CREATE POLICY "lead_qualification_config_service_all" ON lead_qualification_config FOR ALL USING (true);

-- ============================================================================
-- 11. POLÍTICAS RLS - lead_qualification_responses
-- ============================================================================
DROP POLICY IF EXISTS "lead_qualification_responses_service_all" ON lead_qualification_responses;
CREATE POLICY "lead_qualification_responses_service_all" ON lead_qualification_responses FOR ALL USING (true);

-- ============================================================================
-- 12. POLÍTICAS RLS - n8n_webhook_config
-- ============================================================================
DROP POLICY IF EXISTS "service_role_all_n8n_config" ON n8n_webhook_config;
DROP POLICY IF EXISTS "n8n_webhook_config_service_all" ON n8n_webhook_config;
CREATE POLICY "n8n_webhook_config_service_all" ON n8n_webhook_config FOR ALL USING (true);

-- ============================================================================
-- 13. FUNÇÃO para updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 14. TRIGGERS para updated_at
-- ============================================================================
DROP TRIGGER IF EXISTS update_briefing_config_updated_at ON briefing_config;
CREATE TRIGGER update_briefing_config_updated_at
  BEFORE UPDATE ON briefing_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_lead_qualification_config_updated_at ON lead_qualification_config;
CREATE TRIGGER update_lead_qualification_config_updated_at
  BEFORE UPDATE ON lead_qualification_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_n8n_webhook_config_updated_at ON n8n_webhook_config;
CREATE TRIGGER update_n8n_webhook_config_updated_at
  BEFORE UPDATE ON n8n_webhook_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 15. INSERÇÕES INICIAIS
-- ============================================================================
INSERT INTO briefing_config (webhook_url, is_active)
SELECT NULL, FALSE
WHERE NOT EXISTS (SELECT 1 FROM briefing_config LIMIT 1);

INSERT INTO lead_qualification_config (webhook_url, is_active)
SELECT NULL, FALSE
WHERE NOT EXISTS (SELECT 1 FROM lead_qualification_config LIMIT 1);

-- ============================================================================
-- FIM DA MIGRATION
-- ============================================================================
