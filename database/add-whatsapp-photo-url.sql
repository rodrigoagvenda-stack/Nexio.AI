-- Adiciona coluna de foto de perfil permanente nas conversas
ALTER TABLE conversas_do_whatsapp
ADD COLUMN IF NOT EXISTS whatsapp_photo_url TEXT;

COMMENT ON COLUMN conversas_do_whatsapp.whatsapp_photo_url IS
  'URL permanente da foto de perfil do contato no WhatsApp, salva no Supabase Storage';
