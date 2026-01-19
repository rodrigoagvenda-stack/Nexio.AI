-- ========== MONITOR DE BUGS N8N ==========

-- Instâncias n8n
CREATE TABLE IF NOT EXISTS n8n_instances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  url VARCHAR(255) NOT NULL,
  api_key TEXT NOT NULL, -- encrypted
  check_interval INT DEFAULT 5,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Config IA
CREATE TABLE IF NOT EXISTS ai_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider VARCHAR(50) NOT NULL, -- "openai", "anthropic"
  model VARCHAR(100) NOT NULL, -- "gpt-4", "claude-3.5-sonnet"
  api_key TEXT NOT NULL, -- encrypted
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Config Uazapi
CREATE TABLE IF NOT EXISTS uazapi_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  api_token TEXT NOT NULL, -- encrypted
  instance VARCHAR(100) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Erros detectados n8n
CREATE TABLE IF NOT EXISTS n8n_errors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  instance_id UUID REFERENCES n8n_instances(id) ON DELETE CASCADE,
  execution_id VARCHAR(255),
  workflow_id VARCHAR(255),
  workflow_name VARCHAR(255),
  error_node VARCHAR(255),
  error_message TEXT,
  error_details TEXT,
  ai_analysis TEXT,
  severity VARCHAR(50), -- "low", "medium", "high", "critical"
  notified BOOLEAN DEFAULT false,
  resolved BOOLEAN DEFAULT false,
  timestamp TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index para performance
CREATE INDEX IF NOT EXISTS idx_n8n_errors_instance ON n8n_errors(instance_id);
CREATE INDEX IF NOT EXISTS idx_n8n_errors_timestamp ON n8n_errors(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_n8n_errors_resolved ON n8n_errors(resolved);


-- ========== FINANCEIRO (WEBHOOKS ASAAS) ==========

-- Agentes webhook Asaas
CREATE TABLE IF NOT EXISTS asaas_agentes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  webhook_id VARCHAR(100) UNIQUE NOT NULL, -- identificador único do webhook
  webhook_secret TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Cobranças recebidas via webhook
CREATE TABLE IF NOT EXISTS asaas_cobrancas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agente_id UUID REFERENCES asaas_agentes(id) ON DELETE CASCADE,
  asaas_id VARCHAR(255) UNIQUE NOT NULL,
  cliente_nome VARCHAR(255),
  cliente_email VARCHAR(255),
  cliente_cpf_cnpj VARCHAR(20),
  valor DECIMAL(10,2) NOT NULL,
  status VARCHAR(50) NOT NULL, -- PENDING, CONFIRMED, RECEIVED, OVERDUE, REFUNDED
  vencimento DATE,
  pago_em TIMESTAMP,
  webhook_payload JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index para performance
CREATE INDEX IF NOT EXISTS idx_asaas_cobrancas_agente ON asaas_cobrancas(agente_id);
CREATE INDEX IF NOT EXISTS idx_asaas_cobrancas_status ON asaas_cobrancas(status);
CREATE INDEX IF NOT EXISTS idx_asaas_cobrancas_vencimento ON asaas_cobrancas(vencimento);
CREATE INDEX IF NOT EXISTS idx_asaas_cobrancas_asaas_id ON asaas_cobrancas(asaas_id);


-- ========== RLS POLICIES (Row Level Security) ==========

-- n8n_instances: apenas admins
ALTER TABLE n8n_instances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage n8n instances" ON n8n_instances
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.is_active = true
    )
  );

-- ai_config: apenas admins
ALTER TABLE ai_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage ai config" ON ai_config
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.is_active = true
    )
  );

-- uazapi_config: apenas admins
ALTER TABLE uazapi_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage uazapi config" ON uazapi_config
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.is_active = true
    )
  );

-- n8n_errors: apenas admins
ALTER TABLE n8n_errors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view n8n errors" ON n8n_errors
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.is_active = true
    )
  );

-- asaas_agentes: apenas admins
ALTER TABLE asaas_agentes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage asaas agentes" ON asaas_agentes
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.is_active = true
    )
  );

-- asaas_cobrancas: apenas admins
ALTER TABLE asaas_cobrancas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view asaas cobrancas" ON asaas_cobrancas
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.is_active = true
    )
  );
