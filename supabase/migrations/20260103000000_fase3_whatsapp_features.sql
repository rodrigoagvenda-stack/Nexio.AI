-- ============================================================================
-- MIGRATION: FASE 3 - Funcionalidades Básicas WhatsApp
-- Data: 2026-01-03
-- Descrição: Adicionar recursos de reações, edição, fixar mensagens e presença
-- ============================================================================

-- ============================================================================
-- 1. ADICIONAR COLUNAS NA TABELA mensagens_do_whatsapp
-- ============================================================================

-- Campo para indicar se mensagem foi editada
ALTER TABLE mensagens_do_whatsapp
  ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT FALSE;

-- Campo para timestamp da última edição
ALTER TABLE mensagens_do_whatsapp
  ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;

-- Campo para indicar se mensagem está fixada
ALTER TABLE mensagens_do_whatsapp
  ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE;

-- Campo para armazenar reações (JSON array de objetos {emoji, user_id, created_at})
ALTER TABLE mensagens_do_whatsapp
  ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '[]'::jsonb;

-- ============================================================================
-- 2. CRIAR TABELA: typing_status (Presença/Digitando)
-- ============================================================================

CREATE TABLE IF NOT EXISTS typing_status (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES conversas_do_whatsapp(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  is_typing BOOLEAN DEFAULT TRUE,
  last_typed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(conversation_id, user_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_typing_status_conversation_id ON typing_status(conversation_id);
CREATE INDEX IF NOT EXISTS idx_typing_status_user_id ON typing_status(user_id);

-- Comentários
COMMENT ON TABLE typing_status IS 'Status de digitação em tempo real para conversas do WhatsApp';
COMMENT ON COLUMN typing_status.is_typing IS 'Se o usuário está digitando no momento';
COMMENT ON COLUMN typing_status.last_typed_at IS 'Timestamp da última atividade de digitação';

-- ============================================================================
-- 3. COMENTÁRIOS DAS NOVAS COLUNAS
-- ============================================================================

COMMENT ON COLUMN mensagens_do_whatsapp.is_edited IS 'Indica se a mensagem foi editada';
COMMENT ON COLUMN mensagens_do_whatsapp.edited_at IS 'Timestamp da última edição da mensagem';
COMMENT ON COLUMN mensagens_do_whatsapp.is_pinned IS 'Indica se a mensagem está fixada no chat';
COMMENT ON COLUMN mensagens_do_whatsapp.reactions IS 'Array JSON com reações da mensagem [{emoji, user_id, created_at}]';

-- ============================================================================
-- 4. RLS (Row Level Security) para typing_status
-- ============================================================================

ALTER TABLE typing_status ENABLE ROW LEVEL SECURITY;

-- Política: Usuários podem ver status de digitação de conversas da sua empresa
CREATE POLICY "Users can view typing status from their company conversations"
  ON typing_status FOR SELECT
  USING (
    conversation_id IN (
      SELECT id FROM conversas_do_whatsapp
      WHERE company_id IN (
        SELECT company_id FROM users WHERE auth_user_id = auth.uid()
      )
    )
  );

-- Política: Usuários podem inserir seu próprio status de digitação
CREATE POLICY "Users can insert their own typing status"
  ON typing_status FOR INSERT
  WITH CHECK (user_id IN (
    SELECT user_id FROM users WHERE auth_user_id = auth.uid()
  ));

-- Política: Usuários podem atualizar seu próprio status de digitação
CREATE POLICY "Users can update their own typing status"
  ON typing_status FOR UPDATE
  USING (user_id IN (
    SELECT user_id FROM users WHERE auth_user_id = auth.uid()
  ));

-- Política: Usuários podem deletar seu próprio status de digitação
CREATE POLICY "Users can delete their own typing status"
  ON typing_status FOR DELETE
  USING (user_id IN (
    SELECT user_id FROM users WHERE auth_user_id = auth.uid()
  ));

-- ============================================================================
-- 5. FUNÇÃO: Limpar status de digitação antigos (> 10 segundos)
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_old_typing_status()
RETURNS void AS $$
BEGIN
  DELETE FROM typing_status
  WHERE last_typed_at < NOW() - INTERVAL '10 seconds';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 6. ÍNDICES ADICIONAIS PARA PERFORMANCE
-- ============================================================================

-- Índice para mensagens fixadas
CREATE INDEX IF NOT EXISTS idx_mensagens_pinned ON mensagens_do_whatsapp(is_pinned)
  WHERE is_pinned = TRUE;

-- Índice para mensagens editadas
CREATE INDEX IF NOT EXISTS idx_mensagens_edited ON mensagens_do_whatsapp(is_edited)
  WHERE is_edited = TRUE;
