-- ─── SDR Schema Safety — garante todas as colunas necessárias ────────────────
-- Idempotente: usa IF NOT EXISTS / DO NOTHING em tudo

-- sdr_configs: tabela pode ter sido criada pelo database/sdr-migration.sql manualmente
CREATE TABLE IF NOT EXISTS sdr_configs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id            BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  agent_type            TEXT NOT NULL DEFAULT 'atendimento_venda'
                          CHECK (agent_type IN ('atendimento_venda', 'atendimento_venda_agendamento')),
  prompt                TEXT NOT NULL DEFAULT '',
  agente_ativo          BOOLEAN NOT NULL DEFAULT false,
  uazapi_instance_name  TEXT,
  uazapi_instance_url   TEXT DEFAULT 'https://nexioai.uazapi.com',
  uazapi_token          TEXT,
  google_calendar_id    TEXT,
  google_credentials    TEXT,
  openai_key            TEXT,
  webhook_url           TEXT,
  instance_status       TEXT DEFAULT 'disconnected'
                          CHECK (instance_status IN ('disconnected', 'connecting', 'connected')),
  instance_phone        TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id)
);

ALTER TABLE sdr_configs ENABLE ROW LEVEL SECURITY;

-- Política de leitura (service role bypassa RLS)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'sdr_configs' AND policyname = 'users_read_own_company_sdr'
  ) THEN
    CREATE POLICY "users_read_own_company_sdr" ON sdr_configs
      FOR SELECT USING (
        company_id IN (SELECT company_id FROM users WHERE auth_user_id = auth.uid())
      );
  END IF;
END $$;

-- sdr_flows: garante colunas que podem ter sido adicionadas depois da criação original
ALTER TABLE sdr_flows ADD COLUMN IF NOT EXISTS inbox_mode TEXT DEFAULT 'suporte'
  CHECK (inbox_mode IN ('vendas', 'suporte'));

ALTER TABLE sdr_flows ADD COLUMN IF NOT EXISTS vector_table_conhecimento TEXT;
ALTER TABLE sdr_flows ADD COLUMN IF NOT EXISTS vector_table_objecoes TEXT;
ALTER TABLE sdr_flows ADD COLUMN IF NOT EXISTS orchestrator_prompt TEXT;
ALTER TABLE sdr_flows ADD COLUMN IF NOT EXISTS conhecimento_ativo BOOLEAN DEFAULT true;
ALTER TABLE sdr_flows ADD COLUMN IF NOT EXISTS objecoes_ativo BOOLEAN DEFAULT false;

-- platform_config: garante groq_api_key
INSERT INTO platform_config (key, value, is_encrypted) VALUES
  ('groq_api_key', '', true)
ON CONFLICT (key) DO NOTHING;

-- Função updated_at para sdr_configs (idempotente)
CREATE OR REPLACE FUNCTION update_sdr_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_sdr_configs_updated_at'
  ) THEN
    CREATE TRIGGER trigger_sdr_configs_updated_at
      BEFORE UPDATE ON sdr_configs
      FOR EACH ROW EXECUTE FUNCTION update_sdr_configs_updated_at();
  END IF;
END $$;
