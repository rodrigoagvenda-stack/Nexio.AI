ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE REFERENCES auth.users(id);

CREATE TABLE IF NOT EXISTS system_bugs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id BIGINT REFERENCES companies(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto', 'em_analise', 'resolvido', 'fechado')),
  prioridade TEXT NOT NULL DEFAULT 'media' CHECK (prioridade IN ('baixa', 'media', 'alta', 'critica')),
  tipo TEXT NOT NULL DEFAULT 'bug' CHECK (tipo IN ('bug', 'feature', 'melhoria', 'outro')),
  url_pagina TEXT,
  navegador TEXT,
  resolucao TEXT,
  resolvido_por_id INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
  resolvido_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_bugs_company ON system_bugs(company_id);
CREATE INDEX IF NOT EXISTS idx_system_bugs_user ON system_bugs(user_id);
CREATE INDEX IF NOT EXISTS idx_system_bugs_status ON system_bugs(status);
CREATE INDEX IF NOT EXISTS idx_system_bugs_prioridade ON system_bugs(prioridade);
CREATE INDEX IF NOT EXISTS idx_system_bugs_created_at ON system_bugs(created_at DESC);

ALTER TABLE system_bugs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view all bugs" ON system_bugs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.auth_user_id = auth.uid()
      AND admin_users.is_active = true
    )
  );

CREATE POLICY "Admin can update bugs" ON system_bugs
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.auth_user_id = auth.uid()
      AND admin_users.is_active = true
    )
  );

CREATE POLICY "Users can create bugs for their company" ON system_bugs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.user_id = system_bugs.user_id
      AND users.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view bugs from their company" ON system_bugs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.company_id = system_bugs.company_id
      AND users.auth_user_id = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS transacoes_financeiras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id BIGINT REFERENCES companies(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('receita', 'despesa')),
  categoria TEXT NOT NULL,
  valor DECIMAL(10, 2) NOT NULL,
  descricao TEXT NOT NULL,
  data_transacao DATE NOT NULL,
  metodo_pagamento TEXT CHECK (metodo_pagamento IN ('pix', 'boleto', 'cartao', 'transferencia')),
  status TEXT NOT NULL DEFAULT 'concluida' CHECK (status IN ('pendente', 'concluida', 'cancelada')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transacoes_company ON transacoes_financeiras(company_id);
CREATE INDEX IF NOT EXISTS idx_transacoes_tipo ON transacoes_financeiras(tipo);
CREATE INDEX IF NOT EXISTS idx_transacoes_data ON transacoes_financeiras(data_transacao DESC);
CREATE INDEX IF NOT EXISTS idx_transacoes_created_at ON transacoes_financeiras(created_at DESC);

ALTER TABLE transacoes_financeiras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage transactions" ON transacoes_financeiras
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.auth_user_id = auth.uid()
      AND admin_users.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.auth_user_id = auth.uid()
      AND admin_users.is_active = true
    )
  );

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_system_bugs_updated_at
  BEFORE UPDATE ON system_bugs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transacoes_updated_at
  BEFORE UPDATE ON transacoes_financeiras
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
