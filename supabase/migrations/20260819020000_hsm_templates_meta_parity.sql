-- Paridade Meta Cloud API no canvas : header de mídia, botões e carrossel
-- pra Templates HSM (hoje só suporta BODY de texto plano)

ALTER TABLE hsm_templates
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'simple',  -- simple | buttons | carousel
  ADD COLUMN IF NOT EXISTS header_type TEXT,                      -- none | image | video
  ADD COLUMN IF NOT EXISTS header_handle TEXT,                    -- handle da Resumable Upload API (criação/revisão)
  ADD COLUMN IF NOT EXISTS buttons JSONB,                         -- [{type: quick_reply|url, text, url?}]
  ADD COLUMN IF NOT EXISTS carousel_cards JSONB;                  -- [{header_type, header_handle, body_text, buttons}]

COMMENT ON COLUMN hsm_templates.kind IS 'simple | buttons | carousel : define o shape de components montado na submissão';
COMMENT ON COLUMN hsm_templates.header_handle IS 'Handle da Resumable Upload API : usado só na criação/revisão, não no envio (envio usa link ou media id, ver lib/sdr/whatsapp-sender.ts)';
