-- Adicionar campos de mídia à tabela mensagens_do_whatsapp
ALTER TABLE mensagens_do_whatsapp
ADD COLUMN IF NOT EXISTS media_url TEXT,
ADD COLUMN IF NOT EXISTS media_caption TEXT,
ADD COLUMN IF NOT EXISTS media_filename TEXT;

-- Criar índice para buscar mensagens com mídia
CREATE INDEX IF NOT EXISTS idx_mensagens_media_url ON mensagens_do_whatsapp(media_url) WHERE media_url IS NOT NULL;

-- Comentários
COMMENT ON COLUMN mensagens_do_whatsapp.media_url IS 'URL da mídia (imagem, áudio, documento, etc)';
COMMENT ON COLUMN mensagens_do_whatsapp.media_caption IS 'Legenda da mídia (quando aplicável)';
COMMENT ON COLUMN mensagens_do_whatsapp.media_filename IS 'Nome do arquivo original (para documentos)';
