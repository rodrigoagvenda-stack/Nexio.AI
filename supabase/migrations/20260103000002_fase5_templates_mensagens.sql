-- ============================================================================
-- FASE 5: Templates de Mensagens & Respostas Rápidas
-- Data: 2026-01-03
-- Descrição: Sistema de templates reutilizáveis com atalhos e variáveis
-- ============================================================================

-- ============================================================================
-- 1. CRIAR TABELA message_templates
-- ============================================================================

CREATE TABLE IF NOT EXISTS message_templates (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,

  -- Dados do Template
  name VARCHAR(100) NOT NULL,
  content TEXT NOT NULL,
  shortcut VARCHAR(50) UNIQUE, -- Ex: /oi, /preco, /obrigado
  category VARCHAR(50) DEFAULT 'geral', -- geral, saudacao, followup, preco, agendamento

  -- Metadados
  is_active BOOLEAN DEFAULT TRUE,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_category CHECK (
    category IN ('geral', 'saudacao', 'followup', 'preco', 'agendamento', 'encerramento')
  ),
  CONSTRAINT valid_shortcut_format CHECK (
    shortcut IS NULL OR shortcut ~ '^/[a-z0-9_-]+$'
  )
);

-- ============================================================================
-- 2. CRIAR ÍNDICES PARA PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_templates_company
  ON message_templates(company_id);

CREATE INDEX IF NOT EXISTS idx_templates_shortcut
  ON message_templates(shortcut) WHERE shortcut IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_templates_active
  ON message_templates(company_id, is_active) WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_templates_category
  ON message_templates(company_id, category);

-- ============================================================================
-- 3. ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;

-- Policy: Usuários podem ver templates da sua empresa
CREATE POLICY "Users can view templates from their company"
  ON message_templates FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE user_id = auth.uid()
    )
  );

-- Policy: Usuários podem criar templates para sua empresa
CREATE POLICY "Users can create templates for their company"
  ON message_templates FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM users WHERE user_id = auth.uid()
    )
  );

-- Policy: Usuários podem atualizar templates da sua empresa
CREATE POLICY "Users can update templates from their company"
  ON message_templates FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM users WHERE user_id = auth.uid()
    )
  );

-- Policy: Usuários podem deletar templates da sua empresa
CREATE POLICY "Users can delete templates from their company"
  ON message_templates FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- 4. FUNÇÃO PARA ATUALIZAR updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_message_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_message_templates_updated_at
  BEFORE UPDATE ON message_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_message_templates_updated_at();

-- ============================================================================
-- 5. TEMPLATES PADRÃO (EXEMPLOS)
-- ============================================================================

-- Nota: Estes serão inseridos por empresa via API, não aqui
-- Apenas documentação de exemplos:

COMMENT ON TABLE message_templates IS 'Templates de mensagens reutilizáveis com atalhos';
COMMENT ON COLUMN message_templates.shortcut IS 'Atalho para inserir template (ex: /oi, /preco)';
COMMENT ON COLUMN message_templates.content IS 'Conteúdo do template. Suporta variáveis: {{nome}}, {{empresa}}, {{telefone}}';
COMMENT ON COLUMN message_templates.category IS 'Categoria: geral, saudacao, followup, preco, agendamento, encerramento';
COMMENT ON COLUMN message_templates.usage_count IS 'Contador de quantas vezes o template foi utilizado';

-- Exemplos de templates (documentação):
-- /oi -> "Olá {{nome}}! Tudo bem? Meu nome é {{usuario}} da {{minha_empresa}}."
-- /preco -> "O valor do investimento para o serviço que você mencionou é de R$ {{valor}}. Podemos agendar uma conversa?"
-- /obrigado -> "Muito obrigado pelo contato, {{nome}}! Qualquer dúvida, estou à disposição."
-- /agenda -> "Perfeito! Vou agendar para {{data}} às {{hora}}. Confirma?"
