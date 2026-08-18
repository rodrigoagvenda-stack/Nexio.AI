ALTER TABLE hsm_templates ADD COLUMN IF NOT EXISTS header_media_url TEXT;

COMMENT ON COLUMN hsm_templates.header_media_url IS 'URL pública (Supabase Storage) da mídia de header : fonte de verdade pro upload na Meta, feito na hora de submeter (não na criação, handle pode expirar)';
