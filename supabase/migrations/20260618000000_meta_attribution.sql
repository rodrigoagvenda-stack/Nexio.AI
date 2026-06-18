-- Atribuição Meta Ads: armazena dados do referral click-to-WhatsApp e GTPRO
ALTER TABLE leads ADD COLUMN IF NOT EXISTS meta_attribution JSONB;

-- GTPRO API Key por empresa (armazenado junto com config do SDR)
ALTER TABLE sdr_configs ADD COLUMN IF NOT EXISTS gtpro_api_key TEXT;

NOTIFY pgrst, 'reload schema';
