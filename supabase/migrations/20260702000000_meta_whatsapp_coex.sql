-- Meta WhatsApp Cloud API + CoEx support
ALTER TABLE sdr_configs ADD COLUMN IF NOT EXISTS whatsapp_provider    TEXT DEFAULT 'uazapi' CHECK (whatsapp_provider IN ('uazapi', 'meta'));
ALTER TABLE sdr_configs ADD COLUMN IF NOT EXISTS meta_wa_phone_number_id TEXT;
ALTER TABLE sdr_configs ADD COLUMN IF NOT EXISTS meta_wa_waba_id         TEXT;
ALTER TABLE sdr_configs ADD COLUMN IF NOT EXISTS meta_wa_token           TEXT;

NOTIFY pgrst, 'reload schema';
