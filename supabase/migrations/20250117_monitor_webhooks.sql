CREATE TABLE IF NOT EXISTS n8n_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  url VARCHAR(255) NOT NULL,
  api_key TEXT NOT NULL,
  check_interval INT DEFAULT 5,
  active BOOLEAN DEFAULT true,
  last_check TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_config (
  id SERIAL PRIMARY KEY,
  provider VARCHAR(50) NOT NULL,
  model VARCHAR(100) NOT NULL,
  api_key TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS uazapi_config (
  id SERIAL PRIMARY KEY,
  api_token TEXT NOT NULL,
  instance VARCHAR(100) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS n8n_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID REFERENCES n8n_instances(id) ON DELETE CASCADE,
  execution_id VARCHAR(255),
  workflow_id VARCHAR(255),
  workflow_name VARCHAR(255),
  error_node VARCHAR(255),
  error_message TEXT,
  error_details TEXT,
  ai_analysis TEXT,
  severity VARCHAR(50) DEFAULT 'medium',
  notified BOOLEAN DEFAULT false,
  resolved BOOLEAN DEFAULT false,
  timestamp TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);


CREATE TABLE IF NOT EXISTS webhook_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  url TEXT,
  secret TEXT,
  is_active BOOLEAN DEFAULT true,
  config JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_n8n_errors_instance ON n8n_errors(instance_id);
CREATE INDEX IF NOT EXISTS idx_n8n_errors_timestamp ON n8n_errors(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_configs_type ON webhook_configs(type);

ALTER TABLE n8n_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE uazapi_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE n8n_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage n8n instances" ON n8n_instances FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM admin_users WHERE admin_users.auth_user_id = auth.uid() AND admin_users.is_active = true))
  WITH CHECK (EXISTS (SELECT 1 FROM admin_users WHERE admin_users.auth_user_id = auth.uid() AND admin_users.is_active = true));

CREATE POLICY "Admin can manage ai config" ON ai_config FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM admin_users WHERE admin_users.auth_user_id = auth.uid() AND admin_users.is_active = true))
  WITH CHECK (EXISTS (SELECT 1 FROM admin_users WHERE admin_users.auth_user_id = auth.uid() AND admin_users.is_active = true));

CREATE POLICY "Admin can manage uazapi config" ON uazapi_config FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM admin_users WHERE admin_users.auth_user_id = auth.uid() AND admin_users.is_active = true))
  WITH CHECK (EXISTS (SELECT 1 FROM admin_users WHERE admin_users.auth_user_id = auth.uid() AND admin_users.is_active = true));

CREATE POLICY "Admin can view n8n errors" ON n8n_errors FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM admin_users WHERE admin_users.auth_user_id = auth.uid() AND admin_users.is_active = true));

CREATE POLICY "Admin can manage webhooks" ON webhook_configs FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM admin_users WHERE admin_users.auth_user_id = auth.uid() AND admin_users.is_active = true))
  WITH CHECK (EXISTS (SELECT 1 FROM admin_users WHERE admin_users.auth_user_id = auth.uid() AND admin_users.is_active = true));

CREATE OR REPLACE FUNCTION update_updated_at_webhook()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_n8n_instances_updated_at
  BEFORE UPDATE ON n8n_instances
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_webhook();

CREATE TRIGGER update_webhook_configs_updated_at
  BEFORE UPDATE ON webhook_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_webhook();
