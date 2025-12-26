-- Criar tabela de logs de atividade para notificações
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_activity_logs_company_id ON activity_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action);

-- RLS Policies
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Usuários podem ver logs da própria empresa
CREATE POLICY "Users can view their company's activity logs"
  ON activity_logs
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

-- Usuários podem criar logs para a própria empresa
CREATE POLICY "Users can create activity logs for their company"
  ON activity_logs
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

-- Comentários
COMMENT ON TABLE activity_logs IS 'Logs de atividades do sistema para notificações em tempo real';
COMMENT ON COLUMN activity_logs.action IS 'Tipo de ação realizada (lead_extraction, lead_status_change, etc)';
COMMENT ON COLUMN activity_logs.description IS 'Descrição legível da atividade';
COMMENT ON COLUMN activity_logs.metadata IS 'Dados adicionais em JSON (IDs, valores antigos/novos, etc)';
