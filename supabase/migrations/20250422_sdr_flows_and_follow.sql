-- ─────────────────────────────────────────────────────────────
-- SDR Flows — multi-fluxo por empresa (até 3)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sdr_flows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id bigint NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  nome text NOT NULL,
  descricao text,
  uazapi_instance text NOT NULL DEFAULT '',
  numero_whatsapp text NOT NULL DEFAULT '',
  tipo text NOT NULL CHECK (tipo IN ('inbound', 'outbound', 'ambos')),
  ativo boolean DEFAULT true,
  orchestrator_prompt text,
  conhecimento_ativo boolean DEFAULT true,
  objecoes_ativo boolean DEFAULT false,
  vector_table_conhecimento text,
  vector_table_objecoes text,
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE sdr_flows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_isolation_sdr_flows" ON sdr_flows
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

-- Índice
CREATE INDEX IF NOT EXISTS idx_sdr_flows_company ON sdr_flows (company_id);

-- ─────────────────────────────────────────────────────────────
-- Follow Sequences — cadências configuráveis
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS follow_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id bigint NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  nome text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('follow_geral', 'anti_noshow')),
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE follow_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_isolation_follow_sequences" ON follow_sequences
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_follow_sequences_company ON follow_sequences (company_id);

-- ─────────────────────────────────────────────────────────────
-- Follow Steps — passos de cada cadência
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS follow_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id uuid NOT NULL REFERENCES follow_sequences(id) ON DELETE CASCADE,
  dia_offset integer NOT NULL,
  horario time NOT NULL DEFAULT '09:00',
  mensagem text,
  usar_ia boolean DEFAULT false,
  ordem integer NOT NULL DEFAULT 0
);

ALTER TABLE follow_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_isolation_follow_steps" ON follow_steps
  USING (
    sequence_id IN (
      SELECT id FROM follow_sequences
      WHERE company_id IN (
        SELECT company_id FROM users WHERE auth_user_id = auth.uid()
      )
    )
  );

CREATE INDEX IF NOT EXISTS idx_follow_steps_sequence ON follow_steps (sequence_id);

-- ─────────────────────────────────────────────────────────────
-- Follow Executions — log de disparos
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS follow_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id bigint NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  sequence_id uuid NOT NULL REFERENCES follow_sequences(id) ON DELETE CASCADE,
  step_id uuid NOT NULL REFERENCES follow_steps(id) ON DELETE CASCADE,
  disparado_em timestamptz DEFAULT now(),
  status text DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'skipped'))
);

ALTER TABLE follow_executions ENABLE ROW LEVEL SECURITY;

-- Sem RLS direto (acesso via service client no cron)

CREATE UNIQUE INDEX IF NOT EXISTS idx_follow_executions_unique
  ON follow_executions (lead_id, step_id);

CREATE INDEX IF NOT EXISTS idx_follow_executions_lead ON follow_executions (lead_id);

-- ─────────────────────────────────────────────────────────────
-- Colunas extras em tabelas existentes (idempotente)
-- ─────────────────────────────────────────────────────────────

-- conversas_do_whatsapp: flag para pausar agente por conversa
ALTER TABLE conversas_do_whatsapp
  ADD COLUMN IF NOT EXISTS agente_pausado boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS assigned_by uuid REFERENCES auth.users(id);

-- leads: campos de agendamento e outbound
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS call_de_venda boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS call_agendada_para timestamptz,
  ADD COLUMN IF NOT EXISTS meet_url text,
  ADD COLUMN IF NOT EXISTS call_status text CHECK (call_status IN ('agendada', 'realizada', 'cancelada', 'noshow')),
  ADD COLUMN IF NOT EXISTS outbound_responded boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS outbound_followups integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS briefing_preenchido boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS briefing_preenchido_em timestamptz,
  ADD COLUMN IF NOT EXISTS resumo_ia text,
  ADD COLUMN IF NOT EXISTS mql_resumo text,
  ADD COLUMN IF NOT EXISTS nivel_interesse text CHECK (nivel_interesse IN ('Quente 🔥', 'Morno 🌡️', 'Frio ❄️')),
  ADD COLUMN IF NOT EXISTS origem text DEFAULT 'inbound';

-- sdr_logs: campo flow_id
ALTER TABLE sdr_logs
  ADD COLUMN IF NOT EXISTS flow_id uuid REFERENCES sdr_flows(id);
