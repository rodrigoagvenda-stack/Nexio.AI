-- ============================================================================
-- PRD Zaapply — Máquina de Vendas — Fase 1 + Épico 6 crítico
-- Data: 2026-08-12
-- Cobre: Épicos 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15
-- ============================================================================

-- ============================================================================
-- ÉPICO 6 — CRÍTICO: ctwa_clid na conversa (deve ser o primeiro dado salvo)
-- ============================================================================

ALTER TABLE conversas_do_whatsapp
  ADD COLUMN IF NOT EXISTS ctwa_clid            TEXT,
  ADD COLUMN IF NOT EXISTS gclid                TEXT,
  ADD COLUMN IF NOT EXISTS attribution_source   TEXT DEFAULT 'organic', -- meta_ctwa | google | organic
  ADD COLUMN IF NOT EXISTS kanban_stage         TEXT DEFAULT 'novo',     -- novo | qualificacao | fila | em_atendimento | negociacao | fechado
  ADD COLUMN IF NOT EXISTS queue_entered_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS current_status       TEXT DEFAULT 'sdr',      -- sdr | livre | em_atendimento | fechada | aguardando_retorno
  ADD COLUMN IF NOT EXISTS briefing             JSONB,
  ADD COLUMN IF NOT EXISTS value_cents          BIGINT,                  -- valor de conversão em centavos
  ADD COLUMN IF NOT EXISTS value_filled_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS value_product_type   TEXT;                    -- fixo | variavel

CREATE INDEX IF NOT EXISTS idx_conversas_ctwa_clid
  ON conversas_do_whatsapp (ctwa_clid)
  WHERE ctwa_clid IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_conversas_kanban
  ON conversas_do_whatsapp (company_id, kanban_stage);

CREATE INDEX IF NOT EXISTS idx_conversas_status
  ON conversas_do_whatsapp (company_id, current_status);

-- ============================================================================
-- ÉPICO 1 — Múltiplos números WhatsApp por empresa
-- ============================================================================

CREATE TABLE IF NOT EXISTS meta_wa_numbers (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  friendly_name    TEXT NOT NULL,
  phone_number     TEXT NOT NULL,
  phone_number_id  TEXT,         -- Meta phone_number_id (igual meta_wa_phone_number_id em sdr_configs)
  waba_id          TEXT,
  token            TEXT,
  provider         TEXT NOT NULL DEFAULT 'meta',  -- meta | uazapi
  status           TEXT NOT NULL DEFAULT 'desconectado', -- conectado | desconectado | pareando | erro
  sdr_enabled      BOOLEAN DEFAULT true,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE (company_id, phone_number)
);

ALTER TABLE conversas_do_whatsapp
  ADD COLUMN IF NOT EXISTS wa_number_id UUID REFERENCES meta_wa_numbers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_wa_numbers_company ON meta_wa_numbers (company_id);
CREATE INDEX IF NOT EXISTS idx_wa_numbers_phone_id ON meta_wa_numbers (phone_number_id) WHERE phone_number_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_conversas_wa_number ON conversas_do_whatsapp (wa_number_id) WHERE wa_number_id IS NOT NULL;

ALTER TABLE meta_wa_numbers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "meta_wa_numbers_company_isolation" ON meta_wa_numbers
  USING (company_id = (SELECT company_id FROM users WHERE auth_user_id = auth.uid() LIMIT 1));

-- ============================================================================
-- ÉPICO 2 — Multi-atendente com inbox compartilhada
-- ============================================================================

CREATE TABLE IF NOT EXISTS attendants (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'atendente',  -- admin | supervisor | atendente
  active      BOOLEAN DEFAULT true,
  online      BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (company_id, email)
);

CREATE INDEX IF NOT EXISTS idx_attendants_company ON attendants (company_id);
CREATE INDEX IF NOT EXISTS idx_attendants_user ON attendants (user_id) WHERE user_id IS NOT NULL;

ALTER TABLE attendants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "attendants_company_isolation" ON attendants
  USING (company_id = (SELECT company_id FROM users WHERE auth_user_id = auth.uid() LIMIT 1));

-- Atualiza conversas para referenciar attendant
ALTER TABLE conversas_do_whatsapp
  ADD COLUMN IF NOT EXISTS current_attendant_id UUID REFERENCES attendants(id) ON DELETE SET NULL;

-- Histórico de atribuições por attendant (complementa o chat_assignments existente)
CREATE TABLE IF NOT EXISTS conversation_assignments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id BIGINT NOT NULL REFERENCES conversas_do_whatsapp(id) ON DELETE CASCADE,
  attendant_id    UUID REFERENCES attendants(id) ON DELETE SET NULL,
  assigned_by     UUID REFERENCES attendants(id) ON DELETE SET NULL,
  assigned_at     TIMESTAMPTZ DEFAULT now(),
  released_at     TIMESTAMPTZ,
  status          TEXT NOT NULL DEFAULT 'ativa'  -- ativa | liberada | transferida
);

CREATE INDEX IF NOT EXISTS idx_conv_assign_conv ON conversation_assignments (conversation_id);
CREATE INDEX IF NOT EXISTS idx_conv_assign_attendant ON conversation_assignments (attendant_id);

ALTER TABLE conversation_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "conv_assign_open" ON conversation_assignments USING (true);

-- ============================================================================
-- ÉPICO 3 — Dois modos de SDR por número
-- ============================================================================

CREATE TABLE IF NOT EXISTS sdr_mode_config (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id            BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  wa_number_id          UUID REFERENCES meta_wa_numbers(id) ON DELETE CASCADE,
  mode                  TEXT NOT NULL DEFAULT 'completo',  -- completo | recepcao
  briefing_fields       JSONB,   -- [{name, label, type, required}]
  qualification_rules   JSONB,
  out_of_hours_message  TEXT,
  created_at            TIMESTAMPTZ DEFAULT now(),
  UNIQUE (company_id, wa_number_id)
);

ALTER TABLE sdr_mode_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sdr_mode_config_isolation" ON sdr_mode_config
  USING (company_id = (SELECT company_id FROM users WHERE auth_user_id = auth.uid() LIMIT 1));

-- ============================================================================
-- ÉPICO 4 — Distribuição automática com cadência
-- ============================================================================

CREATE TABLE IF NOT EXISTS distribution_rules (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  strategy          TEXT NOT NULL DEFAULT 'round_robin',  -- round_robin | by_load | by_availability | by_segment
  segment_field     TEXT,
  warm_up_minutes   INT DEFAULT 5,
  reassign_minutes  INT DEFAULT 10,
  created_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE (company_id)
);

CREATE TABLE IF NOT EXISTS conversation_audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id BIGINT NOT NULL REFERENCES conversas_do_whatsapp(id) ON DELETE CASCADE,
  event_type      TEXT NOT NULL,  -- reassigned | warmed_up | assigned | released | reviewed
  actor           TEXT,           -- 'system' | attendant_id (UUID as text)
  detail          JSONB,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_conv ON conversation_audit_log (conversation_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_type ON conversation_audit_log (event_type, created_at DESC);

ALTER TABLE distribution_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dist_rules_isolation" ON distribution_rules
  USING (company_id = (SELECT company_id FROM users WHERE auth_user_id = auth.uid() LIMIT 1));

ALTER TABLE conversation_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_log_open" ON conversation_audit_log USING (true);

-- ============================================================================
-- ÉPICO 6 — attribution_events + conversion_values
-- ============================================================================

CREATE TABLE IF NOT EXISTS attribution_events (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id       BIGINT NOT NULL REFERENCES conversas_do_whatsapp(id) ON DELETE CASCADE,
  source                TEXT NOT NULL DEFAULT 'organic',  -- meta_ctwa | google | organic
  ctwa_clid             TEXT,
  gclid                 TEXT,
  campaign_id           TEXT,
  campaign_name         TEXT,
  ad_id                 TEXT,
  ad_name               TEXT,
  referral_source_url   TEXT,
  referral_source_type  TEXT,
  referral_headline     TEXT,
  referral_body         TEXT,
  window_type           TEXT,  -- meta_ctwa_72h | organic_free | organic_paid
  captured_at           TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attr_events_conv ON attribution_events (conversation_id);
CREATE INDEX IF NOT EXISTS idx_attr_events_source ON attribution_events (source, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_attr_events_ctwa ON attribution_events (ctwa_clid) WHERE ctwa_clid IS NOT NULL;

ALTER TABLE attribution_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "attribution_events_open" ON attribution_events USING (true);

CREATE TABLE IF NOT EXISTS conversion_values (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id BIGINT NOT NULL REFERENCES conversas_do_whatsapp(id) ON DELETE CASCADE,
  product_type    TEXT NOT NULL DEFAULT 'variavel',  -- fixo | variavel
  value_cents     BIGINT,
  filled_by       UUID REFERENCES attendants(id) ON DELETE SET NULL,
  filled_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE (conversation_id)
);

ALTER TABLE conversion_values ENABLE ROW LEVEL SECURITY;
CREATE POLICY "conversion_values_open" ON conversion_values USING (true);

-- ============================================================================
-- ÉPICO 8 — Conversions API log
-- ============================================================================

CREATE TABLE IF NOT EXISTS conversions_api_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id BIGINT NOT NULL REFERENCES conversas_do_whatsapp(id) ON DELETE CASCADE,
  payload_sent    JSONB NOT NULL,
  response_status INT,
  response_body   JSONB,
  attempt_number  INT DEFAULT 1,
  success         BOOLEAN DEFAULT false,
  sent_at         TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversions_log_conv ON conversions_api_log (conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversions_log_success ON conversions_api_log (success, sent_at DESC);

ALTER TABLE conversions_api_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "conversions_log_open" ON conversions_api_log USING (true);

-- ============================================================================
-- ÉPICO 9 — Painel de saúde do número
-- ============================================================================

CREATE TABLE IF NOT EXISTS number_health_metrics (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wa_number_id         UUID NOT NULL REFERENCES meta_wa_numbers(id) ON DELETE CASCADE,
  quality_rating       TEXT,  -- green | yellow | red
  current_tier         TEXT,  -- tier_1k | tier_10k | tier_100k
  tier_limit           INT,
  response_rate_msg1   NUMERIC(5,2),
  response_rate_msg2   NUMERIC(5,2),
  response_rate_msg3   NUMERIC(5,2),
  volume_sent_24h      INT,
  volume_received_24h  INT,
  measured_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_health_wa_number ON number_health_metrics (wa_number_id, measured_at DESC);

ALTER TABLE number_health_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "health_metrics_open" ON number_health_metrics USING (true);

-- ============================================================================
-- ÉPICO 10 — Templates HSM
-- ============================================================================

CREATE TABLE IF NOT EXISTS hsm_templates (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  category          TEXT NOT NULL,  -- marketing | utility | authentication
  language          TEXT NOT NULL DEFAULT 'pt_BR',
  body              TEXT NOT NULL,
  variables         JSONB,  -- [{index, example}]
  status            TEXT NOT NULL DEFAULT 'pendente',  -- pendente | aprovado | rejeitado
  rejection_reason  TEXT,
  meta_template_id  TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hsm_company ON hsm_templates (company_id, status);

ALTER TABLE hsm_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hsm_templates_isolation" ON hsm_templates
  USING (company_id = (SELECT company_id FROM users WHERE auth_user_id = auth.uid() LIMIT 1));

-- ============================================================================
-- ÉPICO 11 — Horário de atendimento
-- ============================================================================

CREATE TABLE IF NOT EXISTS business_hours (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  wa_number_id  UUID REFERENCES meta_wa_numbers(id) ON DELETE CASCADE,
  day_of_week   INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),  -- 0=domingo...6=sábado
  open_time     TIME,
  close_time    TIME,
  closed        BOOLEAN DEFAULT false,
  UNIQUE (company_id, wa_number_id, day_of_week)
);

CREATE INDEX IF NOT EXISTS idx_business_hours_company ON business_hours (company_id);

ALTER TABLE business_hours ENABLE ROW LEVEL SECURITY;
CREATE POLICY "business_hours_isolation" ON business_hours
  USING (company_id = (SELECT company_id FROM users WHERE auth_user_id = auth.uid() LIMIT 1));

-- ============================================================================
-- ÉPICO 12 — PWA mobile + push + atalhos
-- ============================================================================

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendant_id  UUID NOT NULL REFERENCES attendants(id) ON DELETE CASCADE,
  endpoint      TEXT NOT NULL,
  keys_p256dh   TEXT NOT NULL,
  keys_auth     TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (attendant_id, endpoint)
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "push_subs_open" ON push_subscriptions USING (true);

CREATE TABLE IF NOT EXISTS quick_replies (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  attendant_id  UUID REFERENCES attendants(id) ON DELETE CASCADE,
  shortcut      TEXT NOT NULL,  -- ex: '/proposta'
  content_type  TEXT NOT NULL DEFAULT 'text',  -- text | media | template
  content       TEXT,
  media_url     TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (company_id, attendant_id, shortcut)
);

CREATE INDEX IF NOT EXISTS idx_quick_replies_company ON quick_replies (company_id);

ALTER TABLE quick_replies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quick_replies_isolation" ON quick_replies
  USING (company_id = (SELECT company_id FROM users WHERE auth_user_id = auth.uid() LIMIT 1));

-- ============================================================================
-- ÉPICO 13 — Dashboard de time e SDR
-- ============================================================================

CREATE TABLE IF NOT EXISTS attendant_scores (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendant_id              UUID NOT NULL REFERENCES attendants(id) ON DELETE CASCADE,
  period_start              DATE NOT NULL,
  period_end                DATE NOT NULL,
  avg_response_time_seconds INT,
  conversion_rate           NUMERIC(5,2),
  volume_handled            INT,
  score                     NUMERIC(5,2),
  computed_at               TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scores_attendant ON attendant_scores (attendant_id, period_start DESC);

ALTER TABLE attendant_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scores_open" ON attendant_scores USING (true);

CREATE TABLE IF NOT EXISTS sdr_tool_usage_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id BIGINT NOT NULL REFERENCES conversas_do_whatsapp(id) ON DELETE CASCADE,
  tool_name       TEXT NOT NULL,
  success         BOOLEAN,
  used_at         TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sdr_tool_conv ON sdr_tool_usage_log (conversation_id);
CREATE INDEX IF NOT EXISTS idx_sdr_tool_name ON sdr_tool_usage_log (tool_name, used_at DESC);

ALTER TABLE sdr_tool_usage_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sdr_tool_log_open" ON sdr_tool_usage_log USING (true);

CREATE TABLE IF NOT EXISTS sdr_knowledge_gaps (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id BIGINT NOT NULL REFERENCES conversas_do_whatsapp(id) ON DELETE CASCADE,
  question        TEXT NOT NULL,
  confidence_score NUMERIC(3,2),
  flagged_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_gaps_conv ON sdr_knowledge_gaps (conversation_id);

ALTER TABLE sdr_knowledge_gaps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "knowledge_gaps_open" ON sdr_knowledge_gaps USING (true);

-- ============================================================================
-- ÉPICO 14 — Limites operacionais e memória longa
-- ============================================================================

CREATE TABLE IF NOT EXISTS attendant_limits (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendant_id                UUID NOT NULL UNIQUE REFERENCES attendants(id) ON DELETE CASCADE,
  max_concurrent_conversations INT DEFAULT 15,
  updated_at                  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE attendant_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "attendant_limits_open" ON attendant_limits USING (true);

CREATE TABLE IF NOT EXISTS lead_long_memory (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  phone_number   TEXT NOT NULL,
  summary        TEXT NOT NULL,
  last_updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (company_id, phone_number)
);

CREATE INDEX IF NOT EXISTS idx_long_memory_company ON lead_long_memory (company_id, phone_number);

ALTER TABLE lead_long_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "long_memory_open" ON lead_long_memory USING (true);

-- ============================================================================
-- ÉPICO 15 — View de relatório de conversão por canal
-- ============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS channel_conversion_report AS
SELECT
  ae.source,
  date_trunc('day', c.created_at)::DATE AS day,
  count(DISTINCT c.id)                   AS total_leads,
  count(DISTINCT c.id) FILTER (WHERE c.kanban_stage = 'fechado') AS total_fechados,
  sum(cv.value_cents) FILTER (WHERE c.kanban_stage = 'fechado')  AS total_value_cents
FROM conversas_do_whatsapp c
LEFT JOIN attribution_events ae ON ae.conversation_id = c.id
LEFT JOIN conversion_values  cv ON cv.conversation_id = c.id
GROUP BY ae.source, date_trunc('day', c.created_at)::DATE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_channel_report
  ON channel_conversion_report (source, day);

-- ============================================================================
-- Triggers updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_meta_wa_numbers_updated_at') THEN
    CREATE TRIGGER set_meta_wa_numbers_updated_at
      BEFORE UPDATE ON meta_wa_numbers
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_hsm_templates_updated_at') THEN
    CREATE TRIGGER set_hsm_templates_updated_at
      BEFORE UPDATE ON hsm_templates
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
