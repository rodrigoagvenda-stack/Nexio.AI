-- Adicionar coluna url_da_midia para armazenar URLs de mídias (imagens, áudios, vídeos, documentos)
ALTER TABLE mensagens_do_whatsapp
ADD COLUMN IF NOT EXISTS url_da_midia TEXT;

-- Adicionar comentário para documentar a coluna
COMMENT ON COLUMN mensagens_do_whatsapp.url_da_midia IS 'URL pública da mídia enviada (imagem, áudio, vídeo, documento) armazenada no Supabase Storage bucket whatsapp-media';
