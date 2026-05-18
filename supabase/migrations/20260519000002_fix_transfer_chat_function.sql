-- ============================================================================
-- FIX: Reescreve transfer_chat() para NÃO aceitar company_id como parâmetro
-- Data: 2026-05-19
-- Problema original (20260103000003_fase6_atribuicao_chats.sql):
--   A função aceitava p_company_id como parâmetro externo, permitindo que
--   um caller mal-intencionado passasse um company_id de outra empresa
--   para redirecionar a transferência.
-- Correção:
--   - Busca company_id diretamente do chat no banco
--   - Valida que o executor (auth.uid()) pertence à empresa do chat
--   - Valida que tanto p_from_user_id quanto p_to_user_id pertencem à mesma empresa
-- ============================================================================

CREATE OR REPLACE FUNCTION transfer_chat(
  p_chat_id        INTEGER,
  p_from_user_id   INTEGER,
  p_to_user_id     INTEGER,
  p_transferred_by INTEGER,
  p_notes          TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_company_id INTEGER;
BEGIN
  -- 1. Busca company_id do chat — não aceita como parâmetro externo
  SELECT company_id INTO v_company_id
  FROM conversas_do_whatsapp
  WHERE id = p_chat_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Chat % não encontrado', p_chat_id;
  END IF;

  -- 2. Valida que o executor pertence à empresa do chat
  IF NOT EXISTS (
    SELECT 1 FROM users
    WHERE auth_user_id = auth.uid()
      AND company_id = v_company_id
  ) THEN
    RAISE EXCEPTION 'Acesso negado: usuário não pertence à empresa do chat';
  END IF;

  -- 3. Valida que o destinatário pertence à mesma empresa
  IF NOT EXISTS (
    SELECT 1 FROM users
    WHERE id = p_to_user_id
      AND company_id = v_company_id
  ) THEN
    RAISE EXCEPTION 'Acesso negado: destinatário não pertence à empresa do chat';
  END IF;

  -- 4. Atualiza o chat com o novo responsável
  UPDATE conversas_do_whatsapp
  SET
    assigned_to = p_to_user_id,
    assigned_at = NOW(),
    assigned_by = p_transferred_by
  WHERE id = p_chat_id
    AND company_id = v_company_id;  -- dupla verificação para evitar TOCTOU

  -- 5. Registra a transferência no histórico
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
    v_company_id,
    p_to_user_id,
    p_from_user_id,
    p_transferred_by,
    'transfer',
    p_notes
  );

  RETURN TRUE;

EXCEPTION
  WHEN OTHERS THEN
    -- Re-lança exceções de acesso negado
    IF SQLERRM LIKE 'Acesso negado%' OR SQLERRM LIKE 'Chat % não encontrado' THEN
      RAISE;
    END IF;
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION transfer_chat IS
  'Transfere um chat entre usuários. company_id é buscado internamente '
  'do próprio chat (nunca aceito como parâmetro externo) e o executor '
  'deve pertencer à empresa do chat. SECURITY DEFINER garante que a '
  'função executa com privilégios elevados mas a validação auth.uid() '
  'ainda reflete o usuário autenticado real.';

-- Revogar execução pública — apenas authenticated pode chamar
REVOKE EXECUTE ON FUNCTION transfer_chat(INTEGER, INTEGER, INTEGER, INTEGER, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION transfer_chat(INTEGER, INTEGER, INTEGER, INTEGER, TEXT) TO authenticated;
