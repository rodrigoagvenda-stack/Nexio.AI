-- ============================================================================
-- MIGRATION: FASE 2 - Notas da Equipe + Tags System
-- Data: 2026-01-02
-- Descrição: Criar tabelas para notas do chat e sistema de tags
-- ============================================================================

-- ============================================================================
-- 1. TABELA: chat_notes (Notas da Equipe sobre Leads/Conversas)
-- ============================================================================

CREATE TABLE IF NOT EXISTS chat_notes (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
  conversation_id INTEGER REFERENCES conversas_do_whatsapp(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  note_text TEXT NOT NULL,
  is_pinned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_chat_notes_company_id ON chat_notes(company_id);
CREATE INDEX IF NOT EXISTS idx_chat_notes_lead_id ON chat_notes(lead_id);
CREATE INDEX IF NOT EXISTS idx_chat_notes_conversation_id ON chat_notes(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_notes_created_at ON chat_notes(created_at DESC);

-- Comentários
COMMENT ON TABLE chat_notes IS 'Notas da equipe sobre leads e conversas do WhatsApp';
COMMENT ON COLUMN chat_notes.lead_id IS 'Lead relacionado (opcional)';
COMMENT ON COLUMN chat_notes.conversation_id IS 'Conversa relacionada (opcional)';
COMMENT ON COLUMN chat_notes.is_pinned IS 'Nota fixada/importante';

-- ============================================================================
-- 2. TABELA: tags (Tags/Etiquetas Master)
-- ============================================================================

CREATE TABLE IF NOT EXISTS tags (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  tag_name TEXT NOT NULL,
  tag_color TEXT DEFAULT '#6366f1', -- Cor padrão (indigo)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, tag_name) -- Nome único por empresa
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_tags_company_id ON tags(company_id);

-- Comentários
COMMENT ON TABLE tags IS 'Tags/etiquetas disponíveis por empresa';
COMMENT ON COLUMN tags.tag_color IS 'Cor em hexadecimal para UI (ex: #ff0000)';

-- ============================================================================
-- 3. TABELA: lead_tags (Relação Lead <-> Tags)
-- ============================================================================

CREATE TABLE IF NOT EXISTS lead_tags (
  id SERIAL PRIMARY KEY,
  lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(lead_id, tag_id) -- Um lead não pode ter a mesma tag duplicada
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_lead_tags_lead_id ON lead_tags(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_tags_tag_id ON lead_tags(tag_id);

-- Comentários
COMMENT ON TABLE lead_tags IS 'Relação many-to-many entre leads e tags';

-- ============================================================================
-- 4. TRIGGER: Atualizar updated_at automaticamente em chat_notes
-- ============================================================================

CREATE OR REPLACE FUNCTION update_chat_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER chat_notes_updated_at_trigger
  BEFORE UPDATE ON chat_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_chat_notes_updated_at();

-- ============================================================================
-- 5. RLS (Row Level Security) - Segurança Multi-tenant
-- ============================================================================

-- Habilitar RLS
ALTER TABLE chat_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_tags ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para chat_notes
CREATE POLICY "Users can view notes from their company"
  ON chat_notes FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM users WHERE auth_user_id = auth.uid()
  ));

CREATE POLICY "Users can insert notes for their company"
  ON chat_notes FOR INSERT
  WITH CHECK (company_id IN (
    SELECT company_id FROM users WHERE auth_user_id = auth.uid()
  ));

CREATE POLICY "Users can update notes from their company"
  ON chat_notes FOR UPDATE
  USING (company_id IN (
    SELECT company_id FROM users WHERE auth_user_id = auth.uid()
  ));

CREATE POLICY "Users can delete notes from their company"
  ON chat_notes FOR DELETE
  USING (company_id IN (
    SELECT company_id FROM users WHERE auth_user_id = auth.uid()
  ));

-- Políticas RLS para tags
CREATE POLICY "Users can view tags from their company"
  ON tags FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM users WHERE auth_user_id = auth.uid()
  ));

CREATE POLICY "Users can insert tags for their company"
  ON tags FOR INSERT
  WITH CHECK (company_id IN (
    SELECT company_id FROM users WHERE auth_user_id = auth.uid()
  ));

CREATE POLICY "Users can update tags from their company"
  ON tags FOR UPDATE
  USING (company_id IN (
    SELECT company_id FROM users WHERE auth_user_id = auth.uid()
  ));

CREATE POLICY "Users can delete tags from their company"
  ON tags FOR DELETE
  USING (company_id IN (
    SELECT company_id FROM users WHERE auth_user_id = auth.uid()
  ));

-- Políticas RLS para lead_tags (via lead ownership)
CREATE POLICY "Users can view lead_tags from their company"
  ON lead_tags FOR SELECT
  USING (lead_id IN (
    SELECT id FROM leads WHERE company_id IN (
      SELECT company_id FROM users WHERE auth_user_id = auth.uid()
    )
  ));

CREATE POLICY "Users can insert lead_tags for their company"
  ON lead_tags FOR INSERT
  WITH CHECK (lead_id IN (
    SELECT id FROM leads WHERE company_id IN (
      SELECT company_id FROM users WHERE auth_user_id = auth.uid()
    )
  ));

CREATE POLICY "Users can delete lead_tags from their company"
  ON lead_tags FOR DELETE
  USING (lead_id IN (
    SELECT id FROM leads WHERE company_id IN (
      SELECT company_id FROM users WHERE auth_user_id = auth.uid()
    )
  ));
