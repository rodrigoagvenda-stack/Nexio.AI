-- =============================================================================
-- Setup: Bucket user-uploads e tabela activity_logs
-- Execute no Supabase SQL Editor
-- =============================================================================

-- =====================
-- 1. TABELA ACTIVITY_LOGS (para notificações)
-- =====================
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  metadata JSONB,
  read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_activity_logs_company_id ON activity_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_activity_logs_read ON activity_logs(read);

-- RLS Policies
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Service role tem acesso total
CREATE POLICY "service_role_activity_logs" ON activity_logs
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Usuários podem ver logs da própria empresa
DROP POLICY IF EXISTS "Users can view their company's activity logs" ON activity_logs;
CREATE POLICY "Users can view their company's activity logs"
  ON activity_logs
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE user_id = auth.uid()
    )
  );

-- Usuários podem criar logs para a própria empresa
DROP POLICY IF EXISTS "Users can create activity logs for their company" ON activity_logs;
CREATE POLICY "Users can create activity logs for their company"
  ON activity_logs
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM users WHERE user_id = auth.uid()
    )
  );

-- Usuários podem atualizar logs da própria empresa (marcar como lido)
DROP POLICY IF EXISTS "Users can update their company's activity logs" ON activity_logs;
CREATE POLICY "Users can update their company's activity logs"
  ON activity_logs
  FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE user_id = auth.uid()
    )
  );

-- =====================
-- 2. BUCKET USER-UPLOADS (para fotos de perfil)
-- =====================
-- Nota: Buckets são criados via Dashboard do Supabase, não via SQL
-- Vá em: Storage > New bucket > Nome: "user-uploads" > Marque "Public bucket"

-- Se o bucket já existir, estas policies serão aplicadas:

-- Permitir upload para usuários autenticados
INSERT INTO storage.policies (name, bucket_id, operation, definition, check)
SELECT
  'Allow authenticated uploads',
  'user-uploads',
  'INSERT',
  'true',
  'auth.role() = ''authenticated'''
WHERE NOT EXISTS (
  SELECT 1 FROM storage.policies
  WHERE bucket_id = 'user-uploads' AND name = 'Allow authenticated uploads'
);

-- Permitir leitura pública
INSERT INTO storage.policies (name, bucket_id, operation, definition)
SELECT
  'Allow public read',
  'user-uploads',
  'SELECT',
  'true'
WHERE NOT EXISTS (
  SELECT 1 FROM storage.policies
  WHERE bucket_id = 'user-uploads' AND name = 'Allow public read'
);

-- =====================
-- VERIFICAÇÃO
-- =====================
SELECT 'activity_logs table created' AS status
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'activity_logs');
