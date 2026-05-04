-- ─── system_logs: tabela de logs do sistema ─────────────────────────────────
CREATE TABLE IF NOT EXISTS system_logs (
  id         BIGSERIAL PRIMARY KEY,
  type       TEXT NOT NULL,
  severity   TEXT NOT NULL DEFAULT 'info',
  company_id BIGINT REFERENCES companies(id) ON DELETE SET NULL,
  user_id    UUID,
  message    TEXT NOT NULL,
  payload    JSONB,
  stack_trace TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS system_logs_created_idx   ON system_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS system_logs_severity_idx  ON system_logs (severity, created_at DESC);
CREATE INDEX IF NOT EXISTS system_logs_type_idx      ON system_logs (type, created_at DESC);
CREATE INDEX IF NOT EXISTS system_logs_company_idx   ON system_logs (company_id, created_at DESC);

-- RLS: apenas service role acessa (admin usa service client)
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "system_logs_service_only" ON system_logs;
CREATE POLICY "system_logs_service_only"
  ON system_logs FOR ALL
  USING (false);
