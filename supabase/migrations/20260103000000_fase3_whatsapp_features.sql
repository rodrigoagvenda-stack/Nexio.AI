-- =====================================================
-- FASE 3: Funcionalidades Básicas WhatsApp
-- =====================================================
-- Adiciona funcionalidades de editar, fixar mensagens e presença

-- 1. Adicionar colunas para edição e fixação de mensagens
ALTER TABLE mensagens_do_whatsapp
  ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE;

-- 2. Criar índices para melhorar performance
CREATE INDEX IF NOT EXISTS idx_mensagens_is_pinned
  ON mensagens_do_whatsapp(is_pinned)
  WHERE is_pinned = TRUE;

CREATE INDEX IF NOT EXISTS idx_mensagens_is_edited
  ON mensagens_do_whatsapp(is_edited)
  WHERE is_edited = TRUE;

-- 3. Comentários para documentação
COMMENT ON COLUMN mensagens_do_whatsapp.is_edited IS 'Indica se a mensagem foi editada após o envio';
COMMENT ON COLUMN mensagens_do_whatsapp.edited_at IS 'Data/hora da última edição da mensagem';
COMMENT ON COLUMN mensagens_do_whatsapp.is_pinned IS 'Indica se a mensagem está fixada no chat';
