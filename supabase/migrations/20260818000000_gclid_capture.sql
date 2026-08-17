-- ============================================================================
-- Google Ads : captura de gclid + OAuth próprio (Enhanced Conversions for Leads)
-- ============================================================================

ALTER TABLE tracking_links
  ADD COLUMN IF NOT EXISTS gclid_capture BOOLEAN DEFAULT false;

ALTER TABLE tracking_link_clicks
  ADD COLUMN IF NOT EXISTS gclid TEXT,
  ADD COLUMN IF NOT EXISTS captured_phone TEXT,
  ADD COLUMN IF NOT EXISTS consumed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_tracking_clicks_phone
  ON tracking_link_clicks (company_id, captured_phone)
  WHERE captured_phone IS NOT NULL AND consumed_at IS NULL;

CREATE TABLE IF NOT EXISTS google_ads_integrations (
  id                    BIGSERIAL PRIMARY KEY,
  company_id            BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE UNIQUE,
  access_token          TEXT,
  refresh_token         TEXT NOT NULL,
  expires_at            TIMESTAMPTZ,
  scope                 TEXT,
  email                 TEXT,
  customer_id           TEXT,
  login_customer_id     TEXT,
  developer_token       TEXT,
  conversion_action_id  TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE google_ads_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_google_ads_integration" ON google_ads_integrations
  USING (company_id = (SELECT company_id FROM users WHERE auth_user_id = auth.uid() LIMIT 1));
