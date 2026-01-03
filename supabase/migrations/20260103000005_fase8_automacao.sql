-- =====================================================
-- FASE 8: Automação & Respostas Automáticas
-- =====================================================

-- Tabela de configurações gerais de automação
CREATE TABLE IF NOT EXISTS automation_settings (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Mensagens automáticas
  welcome_message TEXT,
  welcome_enabled BOOLEAN DEFAULT false,
  away_message TEXT,
  away_enabled BOOLEAN DEFAULT false,
  after_hours_message TEXT,
  after_hours_enabled BOOLEAN DEFAULT false,

  -- Configurações gerais
  auto_assign_enabled BOOLEAN DEFAULT false,
  auto_assign_strategy VARCHAR(50) DEFAULT 'round_robin', -- round_robin, least_active, random
  first_response_timeout_minutes INTEGER DEFAULT 5,

  -- Status de disponibilidade
  availability_status VARCHAR(50) DEFAULT 'online', -- online, busy, away, offline

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT unique_company_automation UNIQUE(company_id),
  CONSTRAINT valid_availability_status CHECK (availability_status IN ('online', 'busy', 'away', 'offline')),
  CONSTRAINT valid_auto_assign_strategy CHECK (auto_assign_strategy IN ('round_robin', 'least_active', 'random'))
);

-- Tabela de horário de atendimento
CREATE TABLE IF NOT EXISTS business_hours (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL, -- 0=Domingo, 1=Segunda, ..., 6=Sábado
  is_enabled BOOLEAN DEFAULT true,
  start_time TIME NOT NULL DEFAULT '09:00:00',
  end_time TIME NOT NULL DEFAULT '18:00:00',
  timezone VARCHAR(100) DEFAULT 'America/Sao_Paulo',

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT unique_company_day UNIQUE(company_id, day_of_week),
  CONSTRAINT valid_day_of_week CHECK (day_of_week >= 0 AND day_of_week <= 6),
  CONSTRAINT valid_time_range CHECK (end_time > start_time)
);

-- Tabela de respostas automáticas por palavra-chave
CREATE TABLE IF NOT EXISTS auto_responses (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  name VARCHAR(100) NOT NULL,
  keywords TEXT[] NOT NULL, -- Array de palavras-chave que disparam a resposta
  response_message TEXT NOT NULL,
  match_type VARCHAR(50) DEFAULT 'contains', -- contains, exact, starts_with, ends_with
  case_sensitive BOOLEAN DEFAULT false,

  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0, -- Maior prioridade é verificada primeiro

  -- Estatísticas
  trigger_count INTEGER DEFAULT 0,
  last_triggered_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT valid_match_type CHECK (match_type IN ('contains', 'exact', 'starts_with', 'ends_with'))
);

-- Tabela de log de automações executadas
CREATE TABLE IF NOT EXISTS automation_logs (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  conversation_id INTEGER REFERENCES conversas_do_whatsapp(id) ON DELETE CASCADE,

  automation_type VARCHAR(50) NOT NULL, -- welcome, away, after_hours, keyword_response, auto_assign
  trigger_reason TEXT,
  message_sent TEXT,

  executed_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT valid_automation_type CHECK (automation_type IN ('welcome', 'away', 'after_hours', 'keyword_response', 'auto_assign'))
);

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_automation_settings_company ON automation_settings(company_id);
CREATE INDEX IF NOT EXISTS idx_business_hours_company_day ON business_hours(company_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_auto_responses_company_active ON auto_responses(company_id, is_active);
CREATE INDEX IF NOT EXISTS idx_auto_responses_priority ON auto_responses(company_id, priority DESC);
CREATE INDEX IF NOT EXISTS idx_automation_logs_company_date ON automation_logs(company_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_logs_conversation ON automation_logs(conversation_id);

-- RLS Policies
ALTER TABLE automation_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_logs ENABLE ROW LEVEL SECURITY;

-- Policies para automation_settings
DROP POLICY IF EXISTS automation_settings_select_policy ON automation_settings;
CREATE POLICY automation_settings_select_policy ON automation_settings
  FOR SELECT USING (true);

DROP POLICY IF EXISTS automation_settings_insert_policy ON automation_settings;
CREATE POLICY automation_settings_insert_policy ON automation_settings
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS automation_settings_update_policy ON automation_settings;
CREATE POLICY automation_settings_update_policy ON automation_settings
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS automation_settings_delete_policy ON automation_settings;
CREATE POLICY automation_settings_delete_policy ON automation_settings
  FOR DELETE USING (true);

-- Policies para business_hours
DROP POLICY IF EXISTS business_hours_select_policy ON business_hours;
CREATE POLICY business_hours_select_policy ON business_hours
  FOR SELECT USING (true);

DROP POLICY IF EXISTS business_hours_insert_policy ON business_hours;
CREATE POLICY business_hours_insert_policy ON business_hours
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS business_hours_update_policy ON business_hours;
CREATE POLICY business_hours_update_policy ON business_hours
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS business_hours_delete_policy ON business_hours;
CREATE POLICY business_hours_delete_policy ON business_hours
  FOR DELETE USING (true);

-- Policies para auto_responses
DROP POLICY IF EXISTS auto_responses_select_policy ON auto_responses;
CREATE POLICY auto_responses_select_policy ON auto_responses
  FOR SELECT USING (true);

DROP POLICY IF EXISTS auto_responses_insert_policy ON auto_responses;
CREATE POLICY auto_responses_insert_policy ON auto_responses
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS auto_responses_update_policy ON auto_responses;
CREATE POLICY auto_responses_update_policy ON auto_responses
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS auto_responses_delete_policy ON auto_responses;
CREATE POLICY auto_responses_delete_policy ON auto_responses
  FOR DELETE USING (true);

-- Policies para automation_logs
DROP POLICY IF EXISTS automation_logs_select_policy ON automation_logs;
CREATE POLICY automation_logs_select_policy ON automation_logs
  FOR SELECT USING (true);

DROP POLICY IF EXISTS automation_logs_insert_policy ON automation_logs;
CREATE POLICY automation_logs_insert_policy ON automation_logs
  FOR INSERT WITH CHECK (true);

-- Função para verificar se está dentro do horário de atendimento
CREATE OR REPLACE FUNCTION is_within_business_hours(
  p_company_id INTEGER,
  p_timestamp TIMESTAMP DEFAULT NOW()
)
RETURNS BOOLEAN AS $$
DECLARE
  v_day_of_week INTEGER;
  v_time TIME;
  v_is_open BOOLEAN;
BEGIN
  -- Extrair dia da semana (0=Domingo, 1=Segunda, etc.)
  v_day_of_week := EXTRACT(DOW FROM p_timestamp);
  v_time := p_timestamp::TIME;

  -- Verificar se existe horário configurado para este dia
  SELECT
    CASE
      WHEN is_enabled AND v_time >= start_time AND v_time <= end_time
      THEN true
      ELSE false
    END INTO v_is_open
  FROM business_hours
  WHERE company_id = p_company_id
    AND day_of_week = v_day_of_week;

  -- Se não tem configuração, considerar como horário de atendimento
  RETURN COALESCE(v_is_open, true);
END;
$$ LANGUAGE plpgsql;

-- Função para obter próximo usuário para auto-atribuição
CREATE OR REPLACE FUNCTION get_next_user_for_assignment(
  p_company_id INTEGER,
  p_strategy VARCHAR DEFAULT 'round_robin'
)
RETURNS INTEGER AS $$
DECLARE
  v_user_id INTEGER;
BEGIN
  IF p_strategy = 'least_active' THEN
    -- Atribuir para o usuário com menos chats ativos
    SELECT u.id INTO v_user_id
    FROM users u
    LEFT JOIN conversas_do_whatsapp c ON c.assigned_to = u.id AND c.status = 'open'
    WHERE u.company_id = p_company_id
      AND u.is_active = true
    GROUP BY u.id
    ORDER BY COUNT(c.id) ASC, RANDOM()
    LIMIT 1;

  ELSIF p_strategy = 'random' THEN
    -- Atribuir aleatoriamente
    SELECT id INTO v_user_id
    FROM users
    WHERE company_id = p_company_id
      AND is_active = true
    ORDER BY RANDOM()
    LIMIT 1;

  ELSE -- round_robin (default)
    -- Atribuir para o usuário que está há mais tempo sem receber atribuição
    SELECT u.id INTO v_user_id
    FROM users u
    LEFT JOIN (
      SELECT assigned_to, MAX(assigned_at) as last_assigned
      FROM conversas_do_whatsapp
      WHERE company_id = p_company_id AND assigned_to IS NOT NULL
      GROUP BY assigned_to
    ) ca ON ca.assigned_to = u.id
    WHERE u.company_id = p_company_id
      AND u.is_active = true
    ORDER BY ca.last_assigned ASC NULLS FIRST, u.id
    LIMIT 1;
  END IF;

  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql;

-- Inserir horário de atendimento padrão para empresas existentes
INSERT INTO business_hours (company_id, day_of_week, is_enabled, start_time, end_time)
SELECT
  c.id,
  d.day,
  CASE WHEN d.day IN (0, 6) THEN false ELSE true END, -- Desabilitar finais de semana
  '09:00:00'::TIME,
  '18:00:00'::TIME
FROM companies c
CROSS JOIN (VALUES (0), (1), (2), (3), (4), (5), (6)) AS d(day)
WHERE NOT EXISTS (
  SELECT 1 FROM business_hours bh
  WHERE bh.company_id = c.id AND bh.day_of_week = d.day
);

-- Inserir configuração padrão de automação para empresas existentes
INSERT INTO automation_settings (
  company_id,
  welcome_message,
  welcome_enabled,
  away_message,
  away_enabled,
  after_hours_message,
  after_hours_enabled
)
SELECT
  id,
  'Olá! Seja bem-vindo(a). Como posso ajudá-lo(a) hoje?',
  false,
  'Estou temporariamente ausente. Retornarei em breve.',
  false,
  'Estamos fora do horário de atendimento. Nosso horário é de Segunda a Sexta, das 9h às 18h.',
  false
FROM companies
WHERE NOT EXISTS (
  SELECT 1 FROM automation_settings a WHERE a.company_id = companies.id
);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_automation_settings_updated_at ON automation_settings;
CREATE TRIGGER update_automation_settings_updated_at
  BEFORE UPDATE ON automation_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_business_hours_updated_at ON business_hours;
CREATE TRIGGER update_business_hours_updated_at
  BEFORE UPDATE ON business_hours
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_auto_responses_updated_at ON auto_responses;
CREATE TRIGGER update_auto_responses_updated_at
  BEFORE UPDATE ON auto_responses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
