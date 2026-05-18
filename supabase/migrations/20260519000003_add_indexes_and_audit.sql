-- ============================================================================
-- Índices faltantes + tabela de audit trail com triggers
-- Data: 2026-05-19
-- ============================================================================

-- ============================================================================
-- 1. ÍNDICES FALTANTES
-- ============================================================================

-- chat_notes: índice por user_id (author_id é o nome real da coluna nessa tabela)
-- Nota: a tabela usa author_id para o usuário, não user_id
CREATE INDEX IF NOT EXISTS idx_chat_notes_author_id  ON chat_notes(author_id);

-- reactions: índice por message_id (já existia idx_reactions_message, criamos
-- com nome canônico para facilitar identificação futura)
CREATE INDEX IF NOT EXISTS idx_reactions_message_id  ON reactions(message_id);

-- quotations: índice por product_id (já existia idx_quotations_product, alias canônico)
CREATE INDEX IF NOT EXISTS idx_quotations_product_id ON quotations(product_id);

-- follow_logs: índice por company_id (a coluna company_id existe mas sem índice dedicado)
-- Nota: idx_follow_logs_company já existe em 20260430_follow_logs.sql;
--       IF NOT EXISTS é seguro e não recria.
CREATE INDEX IF NOT EXISTS idx_follow_logs_company_id ON follow_logs(company_id);

-- Índices adicionais úteis identificados no schema
CREATE INDEX IF NOT EXISTS idx_reactions_created_by        ON reactions(created_by);
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_created_by ON scheduled_messages(created_by);
CREATE INDEX IF NOT EXISTS idx_quotations_sent_by          ON quotations(sent_by);
CREATE INDEX IF NOT EXISTS idx_lead_tags_applied_by        ON lead_tags(applied_by);

-- ============================================================================
-- 2. TABELA AUDIT_LOGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id          BIGSERIAL    PRIMARY KEY,
  user_id     UUID         REFERENCES auth.users(id) ON DELETE SET NULL,
  company_id  INTEGER,
  table_name  TEXT         NOT NULL,
  action      TEXT         NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  record_id   TEXT,
  old_values  JSONB,
  new_values  JSONB,
  ip_address  INET,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE audit_logs IS
  'Registro imutável de operações em tabelas sensíveis. '
  'Gravado via triggers SECURITY DEFINER — não editável por usuários.';

-- RLS: usuários veem apenas logs da própria empresa
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_logs_select" ON audit_logs FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM users WHERE auth_user_id = auth.uid()
  ));

-- INSERT permitido somente via trigger/service (authenticated não insere diretamente)
CREATE POLICY "audit_logs_insert" ON audit_logs FOR INSERT
  WITH CHECK (false);  -- bloqueado para authenticated; triggers são SECURITY DEFINER

-- UPDATE e DELETE proibidos para qualquer role não-service
CREATE POLICY "audit_logs_no_update" ON audit_logs FOR UPDATE
  USING (false);

CREATE POLICY "audit_logs_no_delete" ON audit_logs FOR DELETE
  USING (false);

-- Índices para consultas típicas de auditoria
CREATE INDEX IF NOT EXISTS idx_audit_logs_company_id  ON audit_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at  ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_name  ON audit_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id     ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_record_id   ON audit_logs(table_name, record_id);

-- ============================================================================
-- 3. FUNÇÃO DE AUDIT TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION audit_trigger_fn()
RETURNS TRIGGER AS $$
DECLARE
  v_record_id TEXT;
  v_company_id INTEGER;
BEGIN
  -- Determina o record_id dependendo da operação
  v_record_id := CASE
    WHEN TG_OP = 'DELETE' THEN OLD.id::TEXT
    ELSE NEW.id::TEXT
  END;

  -- Tenta extrair company_id do registro (nem todas as tabelas têm esse campo)
  BEGIN
    v_company_id := CASE
      WHEN TG_OP = 'DELETE' THEN (row_to_json(OLD)->>'company_id')::INTEGER
      ELSE (row_to_json(NEW)->>'company_id')::INTEGER
    END;
  EXCEPTION WHEN OTHERS THEN
    v_company_id := NULL;
  END;

  INSERT INTO audit_logs (
    user_id,
    company_id,
    table_name,
    action,
    record_id,
    old_values,
    new_values
  ) VALUES (
    auth.uid(),
    v_company_id,
    TG_TABLE_NAME,
    TG_OP,
    v_record_id,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN row_to_json(OLD)::JSONB ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW)::JSONB ELSE NULL END
  );

  -- Para DELETE, retorna OLD para não bloquear a operação
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION audit_trigger_fn IS
  'Função genérica de audit trail. SECURITY DEFINER permite gravar em '
  'audit_logs mesmo quando RLS bloqueia INSERT direto pelo usuário.';

-- ============================================================================
-- 4. TRIGGERS DE AUDIT NAS TABELAS SENSÍVEIS
-- ============================================================================

-- companies: criações, alterações e remoções de empresas
DROP TRIGGER IF EXISTS audit_companies ON companies;
CREATE TRIGGER audit_companies
  AFTER INSERT OR UPDATE OR DELETE ON companies
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();

-- users: alterações em membros da equipe
DROP TRIGGER IF EXISTS audit_users ON users;
CREATE TRIGGER audit_users
  AFTER INSERT OR UPDATE OR DELETE ON users
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();

-- extra_package_charges (cobranças Asaas): confirmações de pagamento, cancelamentos
-- Nota: a tabela usa tenant_id para company_id — o trigger captura via row_to_json
--       mas o campo será 'tenant_id', não 'company_id'; audit_logs.company_id ficará NULL
--       para essa tabela (aceitável: admin vê via service_role).
DROP TRIGGER IF EXISTS audit_extra_package_charges ON extra_package_charges;
CREATE TRIGGER audit_extra_package_charges
  AFTER INSERT OR UPDATE OR DELETE ON extra_package_charges
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();

-- leads: alterações críticas em leads (status, assigned_to, fechamento)
DROP TRIGGER IF EXISTS audit_leads ON leads;
CREATE TRIGGER audit_leads
  AFTER UPDATE OR DELETE ON leads
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();

-- chat_assignments: histórico de transferências já é registrado manualmente,
-- mas auditamos também via trigger para garantir rastreabilidade
DROP TRIGGER IF EXISTS audit_chat_assignments ON chat_assignments;
CREATE TRIGGER audit_chat_assignments
  AFTER INSERT OR UPDATE OR DELETE ON chat_assignments
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();
