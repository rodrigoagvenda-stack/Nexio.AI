-- ============================================================================
-- BRIEFING FORM - TABELAS
-- ============================================================================
-- Execute este SQL no Supabase SQL Editor
-- ============================================================================

-- Configuração do webhook
CREATE TABLE IF NOT EXISTS briefing_config (
  id SERIAL PRIMARY KEY,
  webhook_url TEXT,
  webhook_secret TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  last_test_at TIMESTAMPTZ,
  last_test_status TEXT, -- 'success', 'failed'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Respostas do formulário
CREATE TABLE IF NOT EXISTS briefing_responses (
  id BIGSERIAL PRIMARY KEY,

  -- Dados do lead (preenchidos no form)
  nome_responsavel TEXT NOT NULL,
  email TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  country_code TEXT DEFAULT '+55',

  -- Dados da empresa
  nome_empresa TEXT NOT NULL,
  site TEXT,
  instagram TEXT,
  segmento TEXT NOT NULL,
  tempo_mercado TEXT NOT NULL,

  -- Marketing
  investe_marketing TEXT NOT NULL, -- 'sim', 'nao'
  resultados TEXT, -- se investe_marketing = 'sim'
  objetivo TEXT, -- se investe_marketing = 'nao'

  -- Financeiro
  faturamento TEXT NOT NULL,
  budget TEXT NOT NULL,

  -- Meta
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  webhook_sent BOOLEAN DEFAULT FALSE,
  webhook_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_briefing_responses_created_at ON briefing_responses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_briefing_responses_email ON briefing_responses(email);
CREATE INDEX IF NOT EXISTS idx_briefing_responses_whatsapp ON briefing_responses(whatsapp);

-- RLS (público pode inserir, admin pode ver tudo)
ALTER TABLE briefing_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE briefing_responses ENABLE ROW LEVEL SECURITY;

-- Service role pode fazer tudo
CREATE POLICY IF NOT EXISTS "briefing_config_service_all" ON briefing_config
  FOR ALL USING (true);

CREATE POLICY IF NOT EXISTS "briefing_responses_service_all" ON briefing_responses
  FOR ALL USING (true);

-- Público pode inserir respostas
CREATE POLICY IF NOT EXISTS "briefing_responses_public_insert" ON briefing_responses
  FOR INSERT WITH CHECK (true);

-- Apenas admins podem ver respostas
CREATE POLICY IF NOT EXISTS "briefing_responses_admin_select" ON briefing_responses
  FOR SELECT USING (
    auth.uid() IN (SELECT auth_user_id FROM admin_users WHERE is_active = true)
  );

-- Apenas admins podem ver configuração
CREATE POLICY IF NOT EXISTS "briefing_config_admin_select" ON briefing_config
  FOR SELECT USING (
    auth.uid() IN (SELECT auth_user_id FROM admin_users WHERE is_active = true)
  );

-- Apenas admins podem atualizar configuração
CREATE POLICY IF NOT EXISTS "briefing_config_admin_update" ON briefing_config
  FOR UPDATE USING (
    auth.uid() IN (SELECT auth_user_id FROM admin_users WHERE is_active = true)
  );

-- Trigger: atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER IF NOT EXISTS update_briefing_config_updated_at
  BEFORE UPDATE ON briefing_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Inserir configuração inicial (vazia)
INSERT INTO briefing_config (webhook_url, is_active)
VALUES (NULL, FALSE)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- FIM DO SCRIPT
-- ============================================================================
