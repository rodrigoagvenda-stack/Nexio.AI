-- ============================================================================
-- FASE 6: Transferência & Atribuição de Atendimentos
-- Data: 2026-01-03
-- Descrição: Sistema de atribuição de chats para membros da equipe
-- ============================================================================

-- ============================================================================
-- 1. ADICIONAR COLUNA assigned_to NA TABELA conversas_do_whatsapp
-- ============================================================================

ALTER TABLE conversas_do_whatsapp
  ADD COLUMN IF NOT EXISTS assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- Comentários das colunas
COMMENT ON COLUMN conversas_do_whatsapp.assigned_to IS 'Usuário responsável pelo atendimento deste chat';
COMMENT ON COLUMN conversas_do_whatsapp.assigned_at IS 'Data/hora da última atribuição';
COMMENT ON COLUMN conversas_do_whatsapp.assigned_by IS 'Usuário que fez a atribuição';

-- ============================================================================
-- 2. CRIAR TABELA DE HISTÓRICO DE ATRIBUIÇÕES
-- ============================================================================

CREATE TABLE IF NOT EXISTS chat_assignments (
  id SERIAL PRIMARY KEY,
  chat_id INTEGER NOT NULL REFERENCES conversas_do_whatsapp(id) ON DELETE CASCADE,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Atribuição
  assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
  assigned_from INTEGER REFERENCES users(id) ON DELETE SET NULL,
  assigned_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Tipo de ação
  action_type VARCHAR(20) DEFAULT 'assign', -- assign, transfer, unassign
  notes TEXT, -- Motivo da transferência/atribuição

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_action_type CHECK (
    action_type IN ('assign', 'transfer', 'unassign')
  )
);

COMMENT ON TABLE chat_assignments IS 'Histórico de atribuições e transferências de chats';
COMMENT ON COLUMN chat_assignments.assigned_to IS 'Usuário para quem o chat foi atribuído';
COMMENT ON COLUMN chat_assignments.assigned_from IS 'Usuário de quem o chat foi transferido (null se primeira atribuição)';
COMMENT ON COLUMN chat_assignments.assigned_by IS 'Usuário que realizou a ação';
COMMENT ON COLUMN chat_assignments.action_type IS 'Tipo de ação: assign (atribuir), transfer (transferir), unassign (desatribuir)';

-- ============================================================================
-- 3. CRIAR ÍNDICES PARA PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_conversas_assigned_to
  ON conversas_do_whatsapp(assigned_to)
  WHERE assigned_to IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_conversas_company_assigned
  ON conversas_do_whatsapp(company_id, assigned_to);

CREATE INDEX IF NOT EXISTS idx_chat_assignments_chat
  ON chat_assignments(chat_id);

CREATE INDEX IF NOT EXISTS idx_chat_assignments_company
  ON chat_assignments(company_id);

CREATE INDEX IF NOT EXISTS idx_chat_assignments_assigned_to
  ON chat_assignments(assigned_to);

-- ============================================================================
-- 4. ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE chat_assignments ENABLE ROW LEVEL SECURITY;

-- Policy: Usuários podem ver histórico de atribuições da sua empresa
CREATE POLICY "Users can view assignments from their company"
  ON chat_assignments FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE user_id = auth.uid()
    )
  );

-- Policy: Usuários podem criar atribuições para sua empresa
CREATE POLICY "Users can create assignments for their company"
  ON chat_assignments FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM users WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- 5. FUNÇÃO PARA AUTO-ATRIBUIR NOVOS CHATS (OPCIONAL)
-- ============================================================================

-- Função para distribuir chats automaticamente entre equipe
CREATE OR REPLACE FUNCTION auto_assign_chat()
RETURNS TRIGGER AS $$
DECLARE
  next_user_id INTEGER;
  company_id_param INTEGER;
BEGIN
  -- Obter company_id do novo chat
  company_id_param := NEW.company_id;

  -- Se já está atribuído, não fazer nada
  IF NEW.assigned_to IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Buscar próximo usuário disponível da empresa (round-robin)
  -- Pode ser customizado com lógica de carga de trabalho
  SELECT u.id INTO next_user_id
  FROM users u
  WHERE u.company_id = company_id_param
    AND u.is_active = true
  ORDER BY (
    SELECT COUNT(*)
    FROM conversas_do_whatsapp c
    WHERE c.assigned_to = u.id
      AND c.status_da_conversa NOT IN ('closed', 'resolved')
  ) ASC
  LIMIT 1;

  -- Se encontrou um usuário, atribuir
  IF next_user_id IS NOT NULL THEN
    NEW.assigned_to := next_user_id;
    NEW.assigned_at := NOW();
    NEW.assigned_by := next_user_id; -- Auto-atribuição

    -- Registrar no histórico
    INSERT INTO chat_assignments (
      chat_id,
      company_id,
      assigned_to,
      assigned_by,
      action_type,
      notes
    ) VALUES (
      NEW.id,
      company_id_param,
      next_user_id,
      next_user_id,
      'assign',
      'Auto-atribuição'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para auto-atribuição (desabilitado por padrão)
-- Descomente para habilitar auto-atribuição
-- CREATE TRIGGER trigger_auto_assign_chat
--   BEFORE INSERT ON conversas_do_whatsapp
--   FOR EACH ROW
--   EXECUTE FUNCTION auto_assign_chat();

-- ============================================================================
-- 6. VIEWS ÚTEIS
-- ============================================================================

-- View para ver carga de trabalho por usuário
CREATE OR REPLACE VIEW user_workload AS
SELECT
  u.id as user_id,
  u.name as user_name,
  u.company_id,
  COUNT(c.id) FILTER (WHERE c.status_da_conversa NOT IN ('closed', 'resolved')) as active_chats,
  COUNT(c.id) FILTER (WHERE c.contagem_nao_lida > 0) as unread_chats,
  COUNT(c.id) as total_assigned_chats
FROM users u
LEFT JOIN conversas_do_whatsapp c ON c.assigned_to = u.id
GROUP BY u.id, u.name, u.company_id;

COMMENT ON VIEW user_workload IS 'Visualização da carga de trabalho por usuário';

-- ============================================================================
-- 7. FUNÇÃO AUXILIAR PARA TRANSFERIR CHAT
-- ============================================================================

CREATE OR REPLACE FUNCTION transfer_chat(
  p_chat_id INTEGER,
  p_from_user_id INTEGER,
  p_to_user_id INTEGER,
  p_transferred_by INTEGER,
  p_company_id INTEGER,
  p_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Atualizar o chat
  UPDATE conversas_do_whatsapp
  SET
    assigned_to = p_to_user_id,
    assigned_at = NOW(),
    assigned_by = p_transferred_by
  WHERE id = p_chat_id
    AND company_id = p_company_id;

  -- Registrar transferência no histórico
  INSERT INTO chat_assignments (
    chat_id,
    company_id,
    assigned_to,
    assigned_from,
    assigned_by,
    action_type,
    notes
  ) VALUES (
    p_chat_id,
    p_company_id,
    p_to_user_id,
    p_from_user_id,
    p_transferred_by,
    'transfer',
    p_notes
  );

  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION transfer_chat IS 'Função auxiliar para transferir chat entre usuários com registro no histórico';
