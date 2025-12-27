-- ============================================================================
-- Tabela de Configuração de Webhooks N8N
-- ============================================================================
-- Execute este SQL no Supabase SQL Editor
-- ============================================================================

CREATE TABLE IF NOT EXISTS n8n_webhook_config (
  id SERIAL PRIMARY KEY,
  webhook_type TEXT NOT NULL UNIQUE, -- 'icp', 'maps', 'whatsapp'
  webhook_url TEXT NOT NULL,
  auth_type TEXT DEFAULT 'basic', -- 'basic', 'bearer', 'none'
  auth_username TEXT,
  auth_password TEXT,
  auth_token TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inserir configuração inicial para ICP
INSERT INTO n8n_webhook_config (webhook_type, webhook_url, auth_type, auth_username, auth_password)
VALUES (
  'icp',
  'https://vendai-n8n.aw5nou.easypanel.host/webhook/eaeeb03b-7336-4e40-ac00-6d644100c6b1',
  'basic',
  'Boladao',
  'Bruniboladao'
)
ON CONFLICT (webhook_type) DO NOTHING;

-- Habilitar RLS
ALTER TABLE n8n_webhook_config ENABLE ROW LEVEL SECURITY;

-- Política: Service role pode fazer tudo
DROP POLICY IF EXISTS "service_role_all_n8n_config" ON n8n_webhook_config;
CREATE POLICY "service_role_all_n8n_config" ON n8n_webhook_config FOR ALL USING (true);

-- Política: Admins podem gerenciar
DROP POLICY IF EXISTS "admins_manage_n8n_config" ON n8n_webhook_config;
CREATE POLICY "admins_manage_n8n_config" ON n8n_webhook_config
  FOR ALL USING (auth.uid() IN (SELECT auth_user_id FROM admin_users WHERE is_active = true));

-- Trigger para updated_at
DROP TRIGGER IF EXISTS update_n8n_webhook_config_updated_at ON n8n_webhook_config;
CREATE TRIGGER update_n8n_webhook_config_updated_at
  BEFORE UPDATE ON n8n_webhook_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Índice
CREATE INDEX IF NOT EXISTS idx_n8n_webhook_config_type ON n8n_webhook_config(webhook_type);

-- ============================================================================
-- FIM
-- ============================================================================
