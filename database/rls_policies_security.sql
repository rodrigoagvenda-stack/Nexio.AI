-- =============================================================================
-- RLS Policies para tabelas UNRESTRICTED
-- Execute no Supabase SQL Editor
-- =============================================================================

-- =====================
-- 1. ADMIN_USERS
-- =====================
-- Esta tabela só deve ser acessível por service_role ou por admins autenticados

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Política: Service role tem acesso total
CREATE POLICY "service_role_admin_users" ON admin_users
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Política: Usuários autenticados podem ver apenas seu próprio registro
CREATE POLICY "users_view_own_admin_record" ON admin_users
  FOR SELECT
  USING (auth.uid() = auth_user_id);

-- =====================
-- 2. SYSTEM_LOGS (audit_logs)
-- =====================
-- Logs podem ser lidos por usuários da mesma empresa ou admins

ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;

-- Política: Service role tem acesso total
CREATE POLICY "service_role_system_logs" ON system_logs
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Política: Usuários podem ver logs da sua empresa
CREATE POLICY "users_view_company_logs" ON system_logs
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE user_id = auth.uid()
    )
  );

-- Política: Usuários autenticados podem criar logs
CREATE POLICY "authenticated_create_logs" ON system_logs
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- =====================
-- 3. CONVERSAS_DO_WHATSAPP
-- =====================
-- Conversas são restritas por empresa

ALTER TABLE conversas_do_whatsapp ENABLE ROW LEVEL SECURITY;

-- Política: Service role tem acesso total
CREATE POLICY "service_role_conversas" ON conversas_do_whatsapp
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Política: Usuários podem ver/gerenciar conversas da sua empresa
CREATE POLICY "users_view_company_conversas" ON conversas_do_whatsapp
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "users_update_company_conversas" ON conversas_do_whatsapp
  FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "users_insert_company_conversas" ON conversas_do_whatsapp
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM users WHERE user_id = auth.uid()
    )
  );

-- =====================
-- 4. MENSAGENS_DO_WHATSAPP
-- =====================
-- Mensagens são restritas por empresa

ALTER TABLE mensagens_do_whatsapp ENABLE ROW LEVEL SECURITY;

-- Política: Service role tem acesso total
CREATE POLICY "service_role_mensagens" ON mensagens_do_whatsapp
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Política: Usuários podem ver mensagens da sua empresa
CREATE POLICY "users_view_company_mensagens" ON mensagens_do_whatsapp
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "users_insert_company_mensagens" ON mensagens_do_whatsapp
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "users_update_company_mensagens" ON mensagens_do_whatsapp
  FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "users_delete_company_mensagens" ON mensagens_do_whatsapp
  FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE user_id = auth.uid()
    )
  );

-- =====================
-- 5. LANCAMENTOS_FINANCEIROS / TRANSACOES_FINANCEIRAS
-- =====================
-- Se a tabela lancamentos_financeiros existir
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'lancamentos_financeiros') THEN
    EXECUTE 'ALTER TABLE lancamentos_financeiros ENABLE ROW LEVEL SECURITY';

    EXECUTE 'CREATE POLICY "service_role_lancamentos" ON lancamentos_financeiros
      FOR ALL
      USING (auth.jwt() ->> ''role'' = ''service_role'')';

    EXECUTE 'CREATE POLICY "users_view_company_lancamentos" ON lancamentos_financeiros
      FOR SELECT
      USING (
        company_id IN (
          SELECT company_id FROM users WHERE user_id = auth.uid()
        )
      )';

    EXECUTE 'CREATE POLICY "users_manage_company_lancamentos" ON lancamentos_financeiros
      FOR ALL
      USING (
        company_id IN (
          SELECT company_id FROM users WHERE user_id = auth.uid()
        )
      )';
  END IF;
END $$;

-- Para transacoes_financeiras (se existir)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'transacoes_financeiras') THEN
    EXECUTE 'ALTER TABLE transacoes_financeiras ENABLE ROW LEVEL SECURITY';

    EXECUTE 'CREATE POLICY "service_role_transacoes" ON transacoes_financeiras
      FOR ALL
      USING (auth.jwt() ->> ''role'' = ''service_role'')';

    EXECUTE 'CREATE POLICY "users_view_company_transacoes" ON transacoes_financeiras
      FOR SELECT
      USING (
        company_id IN (
          SELECT company_id FROM users WHERE user_id = auth.uid()
        )
      )';

    EXECUTE 'CREATE POLICY "users_manage_company_transacoes" ON transacoes_financeiras
      FOR ALL
      USING (
        company_id IN (
          SELECT company_id FROM users WHERE user_id = auth.uid()
        )
      )';
  END IF;
END $$;

-- =====================
-- 6. VW_FINANCEIRO_MENSAL (VIEW)
-- =====================
-- Views não suportam RLS diretamente
-- A segurança vem das tabelas subjacentes
-- Se precisar restringir acesso à view, use SECURITY DEFINER function

-- Criar função segura para acessar a view
CREATE OR REPLACE FUNCTION get_financeiro_mensal(p_company_id BIGINT)
RETURNS TABLE (
  mes TEXT,
  ano INTEGER,
  receitas DECIMAL,
  despesas DECIMAL,
  saldo DECIMAL
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Verificar se o usuário tem acesso à empresa
  IF NOT EXISTS (
    SELECT 1 FROM users
    WHERE user_id = auth.uid()
    AND company_id = p_company_id
  ) AND NOT EXISTS (
    SELECT 1 FROM admin_users
    WHERE auth_user_id = auth.uid()
    AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  -- Retornar dados da view filtrados
  RETURN QUERY
  SELECT * FROM vw_financeiro_mensal
  WHERE vw_financeiro_mensal.company_id = p_company_id;
END;
$$;

-- Grant para usuários autenticados
GRANT EXECUTE ON FUNCTION get_financeiro_mensal(BIGINT) TO authenticated;

-- =====================
-- 7. GRANT PERMISSIONS
-- =====================
-- Garantir que service_role tenha acesso total
GRANT ALL ON admin_users TO service_role;
GRANT ALL ON system_logs TO service_role;
GRANT ALL ON conversas_do_whatsapp TO service_role;
GRANT ALL ON mensagens_do_whatsapp TO service_role;

-- Garantir que authenticated tenha permissões básicas (RLS vai filtrar)
GRANT SELECT, INSERT, UPDATE ON conversas_do_whatsapp TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON mensagens_do_whatsapp TO authenticated;
GRANT SELECT ON admin_users TO authenticated;
GRANT SELECT, INSERT ON system_logs TO authenticated;

-- =====================
-- VERIFICAÇÃO
-- =====================
-- Execute este SELECT para verificar se RLS está habilitado
SELECT
  schemaname,
  tablename,
  rowsecurity as "RLS Enabled"
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN (
  'admin_users',
  'system_logs',
  'conversas_do_whatsapp',
  'lancamentos_financeiros',
  'mensagens_do_whatsapp',
  'transacoes_financeiras'
)
ORDER BY tablename;
