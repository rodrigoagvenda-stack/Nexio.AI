-- Platform configuration table
-- Stores infrastructure-level credentials (UAZapi admin token, Google OAuth, Stripe keys)
-- Sensitive values are encrypted at the application layer (AES-256-GCM via ENCRYPTION_KEY env var)

CREATE TABLE IF NOT EXISTS platform_config (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  is_encrypted BOOLEAN NOT NULL DEFAULT false,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only the service role (backend) can read/write this table
ALTER TABLE platform_config ENABLE ROW LEVEL SECURITY;

-- No user-level access — all operations go through service client
CREATE POLICY "service_only" ON platform_config
  USING (false)
  WITH CHECK (false);
