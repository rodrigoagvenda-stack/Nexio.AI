-- ============================================================================
-- VEND.AI - SCHEMA COMPLETO DO BANCO DE DADOS
-- ============================================================================
-- Execute este SQL no Supabase SQL Editor para criar todas as tabelas
-- ============================================================================

-- ============================================================================
-- COMPANIES
-- ============================================================================
CREATE TABLE IF NOT EXISTS companies (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  plan_type TEXT NOT NULL DEFAULT 'basic', -- 'basic', 'performance', 'advanced'
  vendagro_plan TEXT, -- NULL, 'performance', 'advanced'
  plan_monthly_limit INTEGER DEFAULT 0,
  leads_extracted_this_month INTEGER DEFAULT 0,
  last_extraction_month TEXT, -- 'YYYY-MM'
  whatsapp_instance TEXT,
  whatsapp_token TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  subscription_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- USERS
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  auth_user_id UUID UNIQUE REFERENCES auth.users(id),
  user_id UUID UNIQUE NOT NULL,
  company_id BIGINT REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  photo_url TEXT,
  description TEXT,
  department TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- LEADS
-- ============================================================================
CREATE TABLE IF NOT EXISTS leads (
  id BIGSERIAL PRIMARY KEY,
  lead_id UUID UNIQUE DEFAULT gen_random_uuid(),
  company_id BIGINT REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(user_id),
  company_name TEXT NOT NULL,
  contact_name TEXT,
  segment VARCHAR(100),
  website_or_instagram TEXT,
  whatsapp TEXT,
  email TEXT,
  priority VARCHAR(50) DEFAULT 'Média', -- 'Alta', 'Média', 'Baixa'
  status VARCHAR(50) DEFAULT 'Lead novo', -- 'Lead novo', 'Em contato', 'Interessado', 'Proposta enviada', 'Fechado', 'Perdido'
  nivel_interesse VARCHAR(50) DEFAULT 'Morno 🌡️', -- 'Quente 🔥', 'Morno 🌡️', 'Frio ❄️'
  import_source VARCHAR(50), -- 'PEG', 'Google Maps', 'WhatsApp'
  project_value NUMERIC(12,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- ICP CONFIGURATION
-- ============================================================================
CREATE TABLE IF NOT EXISTS icp_configuration (
  id SERIAL PRIMARY KEY,
  company_id INTEGER UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
  idade_min INTEGER,
  idade_max INTEGER,
  renda_min NUMERIC(10,2),
  renda_max NUMERIC(10,2),
  genero TEXT,
  escolaridade TEXT,
  estados TEXT[],
  regioes TEXT[],
  nichos TEXT[],
  tamanho_empresa TEXT,
  tempo_mercado TEXT,
  empresa_funcionarios TEXT,
  canais TEXT[],
  preferencia_contato TEXT,
  horario TEXT,
  linguagem TEXT,
  ciclo_compra TEXT,
  comprou_online BOOLEAN,
  influenciador BOOLEAN,
  budget_min NUMERIC(10,2),
  budget_max NUMERIC(10,2),
  dores TEXT,
  objetivos TEXT,
  leads_por_dia_max INTEGER DEFAULT 3,
  usar_ia BOOLEAN DEFAULT TRUE,
  entregar_fins_semana BOOLEAN DEFAULT FALSE,
  notificar_novos_leads BOOLEAN DEFAULT TRUE,
  prioridade TEXT DEFAULT 'Média',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- ICP LEADS
-- ============================================================================
CREATE TABLE IF NOT EXISTS "ICP_leads" (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT REFERENCES companies(id) ON DELETE CASCADE,
  icp_id BIGINT REFERENCES icp_configuration(id),
  source_lead_id BIGINT REFERENCES leads(id),
  nome TEXT,
  empresa TEXT,
  email TEXT,
  telefone TEXT,
  whatsapp TEXT,
  cidade TEXT,
  estado TEXT,
  segmento TEXT,
  status TEXT DEFAULT 'Novo',
  priority TEXT DEFAULT 'Média',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- CONVERSAS DO WHATSAPP
-- ============================================================================
CREATE TABLE IF NOT EXISTS conversas_do_whatsapp (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT REFERENCES companies(id) ON DELETE CASCADE,
  id_do_lead BIGINT REFERENCES leads(id),
  numero_de_telefone TEXT NOT NULL,
  nome_do_contato TEXT,
  ultima_mensagem TEXT,
  hora_da_ultima_mensagem TIMESTAMPTZ,
  contagem_nao_lida INTEGER DEFAULT 0,
  status_da_conversa TEXT DEFAULT 'aberto', -- 'aberto', 'fechado'
  agente_atribuido TEXT,
  etiquetas TEXT[],
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- MENSAGENS DO WHATSAPP
-- ============================================================================
CREATE TABLE IF NOT EXISTS mensagens_do_whatsapp (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT REFERENCES companies(id) ON DELETE CASCADE,
  id_da_conversacao BIGINT REFERENCES conversas_do_whatsapp(id) ON DELETE CASCADE,
  id_do_lead BIGINT REFERENCES leads(id),
  texto_da_mensagem TEXT,
  tipo_de_mensagem TEXT DEFAULT 'text', -- 'text', 'image', 'audio'
  direcao TEXT NOT NULL, -- 'inbound', 'outbound'
  sender_type VARCHAR(50) DEFAULT 'human', -- 'ai', 'human'
  sender_user_id UUID REFERENCES users(user_id),
  status TEXT DEFAULT 'sent', -- 'sent', 'delivered', 'read', 'failed'
  metadados JSONB,
  carimbo_de_data_e_hora TIMESTAMPTZ DEFAULT NOW(),
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- SYSTEM LOGS
-- ============================================================================
CREATE TABLE IF NOT EXISTS system_logs (
  id BIGSERIAL PRIMARY KEY,
  type TEXT NOT NULL, -- 'webhook', 'error', 'user_action'
  severity TEXT DEFAULT 'info', -- 'info', 'warning', 'error', 'critical'
  company_id BIGINT REFERENCES companies(id),
  user_id UUID REFERENCES users(user_id),
  message TEXT NOT NULL,
  payload JSONB,
  stack_trace TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- ADMIN USERS
-- ============================================================================
CREATE TABLE IF NOT EXISTS admin_users (
  id SERIAL PRIMARY KEY,
  auth_user_id UUID UNIQUE REFERENCES auth.users(id),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT DEFAULT 'admin', -- 'super_admin', 'admin', 'support'
  is_active BOOLEAN DEFAULT TRUE,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- BRIEFING (já existe em briefing-tables.sql)
-- ============================================================================
-- Incluído aqui para completude

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
-- ÍNDICES
-- ============================================================================

-- Companies
CREATE INDEX IF NOT EXISTS idx_companies_email ON companies(email);
CREATE INDEX IF NOT EXISTS idx_companies_is_active ON companies(is_active);

-- Users
CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id);
CREATE INDEX IF NOT EXISTS idx_users_auth_user_id ON users(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Leads
CREATE INDEX IF NOT EXISTS idx_leads_company_id ON leads(company_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);

-- ICP Leads
CREATE INDEX IF NOT EXISTS idx_icp_leads_company_id ON "ICP_leads"(company_id);
CREATE INDEX IF NOT EXISTS idx_icp_leads_created_at ON "ICP_leads"(created_at DESC);

-- WhatsApp
CREATE INDEX IF NOT EXISTS idx_conversas_company_id ON conversas_do_whatsapp(company_id);
CREATE INDEX IF NOT EXISTS idx_mensagens_conversacao_id ON mensagens_do_whatsapp(id_da_conversacao);

-- Logs
CREATE INDEX IF NOT EXISTS idx_logs_type ON system_logs(type);
CREATE INDEX IF NOT EXISTS idx_logs_severity ON system_logs(severity);
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON system_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_company_id ON system_logs(company_id);

-- Briefing
CREATE INDEX IF NOT EXISTS idx_briefing_responses_created_at ON briefing_responses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_briefing_responses_email ON briefing_responses(email);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE icp_configuration ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ICP_leads" ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversas_do_whatsapp ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensagens_do_whatsapp ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE briefing_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE briefing_responses ENABLE ROW LEVEL SECURITY;

-- Service role pode fazer tudo
CREATE POLICY IF NOT EXISTS "service_role_all_companies" ON companies FOR ALL USING (true);
CREATE POLICY IF NOT EXISTS "service_role_all_users" ON users FOR ALL USING (true);
CREATE POLICY IF NOT EXISTS "service_role_all_leads" ON leads FOR ALL USING (true);
CREATE POLICY IF NOT EXISTS "service_role_all_icp_config" ON icp_configuration FOR ALL USING (true);
CREATE POLICY IF NOT EXISTS "service_role_all_icp_leads" ON "ICP_leads" FOR ALL USING (true);
CREATE POLICY IF NOT EXISTS "service_role_all_conversas" ON conversas_do_whatsapp FOR ALL USING (true);
CREATE POLICY IF NOT EXISTS "service_role_all_mensagens" ON mensagens_do_whatsapp FOR ALL USING (true);
CREATE POLICY IF NOT EXISTS "service_role_all_logs" ON system_logs FOR ALL USING (true);
CREATE POLICY IF NOT EXISTS "service_role_all_admin_users" ON admin_users FOR ALL USING (true);
CREATE POLICY IF NOT EXISTS "service_role_all_briefing_config" ON briefing_config FOR ALL USING (true);
CREATE POLICY IF NOT EXISTS "service_role_all_briefing_responses" ON briefing_responses FOR ALL USING (true);

-- Users veem apenas dados da própria empresa
CREATE POLICY IF NOT EXISTS "users_own_company" ON companies
  FOR SELECT USING (id = (SELECT company_id FROM users WHERE auth_user_id = auth.uid()));

CREATE POLICY IF NOT EXISTS "users_own_leads" ON leads
  FOR ALL USING (company_id = (SELECT company_id FROM users WHERE auth_user_id = auth.uid()));

CREATE POLICY IF NOT EXISTS "users_own_icp_leads" ON "ICP_leads"
  FOR ALL USING (company_id = (SELECT company_id FROM users WHERE auth_user_id = auth.uid()));

CREATE POLICY IF NOT EXISTS "users_own_conversas" ON conversas_do_whatsapp
  FOR ALL USING (company_id = (SELECT company_id FROM users WHERE auth_user_id = auth.uid()));

CREATE POLICY IF NOT EXISTS "users_own_mensagens" ON mensagens_do_whatsapp
  FOR ALL USING (
    id_da_conversacao IN (
      SELECT id FROM conversas_do_whatsapp
      WHERE company_id = (SELECT company_id FROM users WHERE auth_user_id = auth.uid())
    )
  );

-- Admins veem tudo
CREATE POLICY IF NOT EXISTS "admins_see_all_companies" ON companies
  FOR ALL USING (auth.uid() IN (SELECT auth_user_id FROM admin_users WHERE is_active = true));

CREATE POLICY IF NOT EXISTS "admins_see_all_logs" ON system_logs
  FOR ALL USING (auth.uid() IN (SELECT auth_user_id FROM admin_users WHERE is_active = true));

-- Público pode inserir briefing
CREATE POLICY IF NOT EXISTS "public_insert_briefing" ON briefing_responses
  FOR INSERT WITH CHECK (true);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_icp_configuration_updated_at BEFORE UPDATE ON icp_configuration
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Inserir configuração inicial do briefing
INSERT INTO briefing_config (webhook_url, is_active)
VALUES (NULL, FALSE)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- FIM DO SCHEMA
-- ============================================================================
