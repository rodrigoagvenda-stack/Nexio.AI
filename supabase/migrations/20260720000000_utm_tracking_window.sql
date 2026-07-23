-- UTM Tracking, Conversation Window & Lead Source Attribution
-- Phase 1: window indicator + CTWA lead_source capture

ALTER TABLE conversas_do_whatsapp
  ADD COLUMN IF NOT EXISTS ultima_mensagem_inbound_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS window_expires_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS window_type               TEXT CHECK (window_type IN ('ctwa', 'regular', NULL)),
  ADD COLUMN IF NOT EXISTS lead_source               JSONB;

-- Index para queries de window no atendimento
CREATE INDEX IF NOT EXISTS idx_conversas_window_expires
  ON conversas_do_whatsapp (company_id, window_expires_at)
  WHERE window_expires_at IS NOT NULL;

-- Phase 2: tabela de links rastreados
CREATE TABLE IF NOT EXISTS tracking_links (
  id           BIGSERIAL PRIMARY KEY,
  company_id   BIGINT REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  slug         TEXT NOT NULL UNIQUE,
  phone        TEXT NOT NULL,
  mensagem     TEXT,
  utm_campaign TEXT,
  utm_source   TEXT,
  utm_medium   TEXT,
  utm_content  TEXT,
  cliques      INTEGER DEFAULT 0,
  criado_em    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tracking_links_company ON tracking_links (company_id);
CREATE INDEX IF NOT EXISTS idx_tracking_links_slug    ON tracking_links (slug);

-- RLS tracking_links
ALTER TABLE tracking_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tracking_links_company_isolation" ON tracking_links
  USING (company_id = (
    SELECT company_id FROM users WHERE auth_user_id = auth.uid() LIMIT 1
  ));

-- Tabela de cliques nos links rastreados (para atribuição quando lead chegar no WA)
CREATE TABLE IF NOT EXISTS tracking_link_clicks (
  id           BIGSERIAL PRIMARY KEY,
  slug         TEXT NOT NULL,
  company_id   BIGINT REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  utm_campaign TEXT,
  utm_source   TEXT,
  utm_medium   TEXT,
  utm_content  TEXT,
  clicked_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tlc_company_slug ON tracking_link_clicks (company_id, slug, clicked_at DESC);

-- Phase 2: config do Pixel da Meta no sdr_configs
ALTER TABLE sdr_configs
  ADD COLUMN IF NOT EXISTS meta_pixel_id     TEXT,
  ADD COLUMN IF NOT EXISTS meta_pixel_token  TEXT;
