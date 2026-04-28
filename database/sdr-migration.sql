-- =============================================================
-- NEXIO AI — SDR Nativo: Migração de banco
-- Executar no Supabase SQL Editor
-- =============================================================

-- 1. Tabela de configuração do SDR por empresa
CREATE TABLE IF NOT EXISTS sdr_configs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id            INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Tipo de agente
  agent_type            TEXT NOT NULL DEFAULT 'atendimento_venda'
                        CHECK (agent_type IN ('atendimento_venda', 'atendimento_venda_agendamento')),

  -- Prompt dinâmico gerado no onboarding (editável depois)
  prompt                TEXT NOT NULL DEFAULT '',

  -- Estado do agente
  agente_ativo          BOOLEAN NOT NULL DEFAULT false,

  -- Credenciais uazapi criptografadas (AES-256-GCM)
  uazapi_instance_name  TEXT,               -- ex: "empresa-xyz"
  uazapi_instance_url   TEXT DEFAULT 'https://nexioai.uazapi.com',
  uazapi_token          TEXT,               -- criptografado

  -- Google Calendar (apenas para tipo com agendamento)
  google_calendar_id    TEXT,
  google_credentials    TEXT,               -- JSON criptografado

  -- OpenAI (opcional — usa chave global se vazio)
  openai_key            TEXT,               -- criptografado

  -- Webhook URL da uazapi (gerado automaticamente)
  webhook_url           TEXT,               -- https://nexioai.online/api/sdr/webhook/{company_id}

  -- Status da instância
  instance_status       TEXT DEFAULT 'disconnected'
                        CHECK (instance_status IN ('disconnected', 'connecting', 'connected')),
  instance_phone        TEXT,

  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(company_id)
);

-- RLS
ALTER TABLE sdr_configs ENABLE ROW LEVEL SECURITY;

-- Admins da plataforma lêem tudo (via service role)
-- Usuários só veem config da própria empresa
CREATE POLICY "users_read_own_company_sdr" ON sdr_configs
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

-- 2. Tabela de buffer de mensagens (agrupa mensagens do mesmo usuário antes de processar)
CREATE TABLE IF NOT EXISTS sdr_message_buffer (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      INTEGER NOT NULL,
  phone           TEXT NOT NULL,
  messages        JSONB NOT NULL DEFAULT '[]',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  expires_at      TIMESTAMPTZ DEFAULT NOW() + INTERVAL '2 minutes',

  UNIQUE(company_id, phone)
);

-- Limpeza automática de buffers expirados (cron ou via trigger)
CREATE INDEX IF NOT EXISTS idx_sdr_buffer_expires ON sdr_message_buffer(expires_at);
CREATE INDEX IF NOT EXISTS idx_sdr_buffer_company_phone ON sdr_message_buffer(company_id, phone);

-- RLS (apenas service role acessa)
ALTER TABLE sdr_message_buffer ENABLE ROW LEVEL SECURITY;

-- 3. Tabela de logs do SDR (para debug e monitoramento)
CREATE TABLE IF NOT EXISTS sdr_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    INTEGER NOT NULL,
  phone         TEXT,
  lead_id       INTEGER,
  event_type    TEXT NOT NULL, -- 'message_received', 'message_sent', 'error', 'agent_disabled', 'human_takeover'
  payload       JSONB,
  error_message TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sdr_logs_company ON sdr_logs(company_id, created_at DESC);
ALTER TABLE sdr_logs ENABLE ROW LEVEL SECURITY;

-- 4. Adicionar coluna agente_ativo na tabela companies (se não existir)
ALTER TABLE companies ADD COLUMN IF NOT EXISTS agente_ativo BOOLEAN DEFAULT false;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS sdr_config_id UUID REFERENCES sdr_configs(id);

-- 5. Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_sdr_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trigger_sdr_configs_updated_at
  BEFORE UPDATE ON sdr_configs
  FOR EACH ROW EXECUTE FUNCTION update_sdr_configs_updated_at();
