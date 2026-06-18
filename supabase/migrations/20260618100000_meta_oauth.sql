ALTER TABLE sdr_configs ADD COLUMN IF NOT EXISTS meta_access_token    TEXT;
ALTER TABLE sdr_configs ADD COLUMN IF NOT EXISTS meta_ad_account_id   TEXT;
ALTER TABLE sdr_configs ADD COLUMN IF NOT EXISTS meta_ad_account_name TEXT;
NOTIFY pgrst, 'reload schema';
