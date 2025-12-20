-- ============================================================================
-- SOLUÇÃO COMPLETA: Fix RLS + Conectar usuário
-- ============================================================================
-- Execute este SQL COMPLETO no Supabase SQL Editor
-- ============================================================================

-- PARTE 1: DESABILITAR COMPLETAMENTE RLS
-- ============================================================================

-- Drop todas as policies
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
            r.policyname, r.schemaname, r.tablename);
    END LOOP;
END $$;

-- Disable RLS em todas as tabelas
ALTER TABLE IF EXISTS companies DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS users DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS leads DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS icp_configuration DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "ICP_leads" DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS conversas_do_whatsapp DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS mensagens_do_whatsapp DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS system_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS admin_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS briefing_config DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS briefing_responses DISABLE ROW LEVEL SECURITY;

-- PARTE 2: CORRIGIR LINK DO USUÁRIO
-- ============================================================================

-- Deletar usuário antigo (se existir)
DELETE FROM users WHERE email = 'admin@vendai.com';

-- Inserir usuário corretamente
-- AUTOMATICAMENTE pega o UUID do auth.users
INSERT INTO users (
  auth_user_id,
  user_id,
  company_id,
  name,
  email,
  is_active
)
SELECT
  au.id as auth_user_id,  -- UUID do Supabase Auth
  gen_random_uuid() as user_id,
  (SELECT id FROM companies WHERE name = 'Empresa Teste - vend.AI' LIMIT 1) as company_id,
  'Admin Teste' as name,
  'admin@vendai.com' as email,
  true as is_active
FROM auth.users au
WHERE au.email = 'admin@vendai.com'
LIMIT 1;

-- PARTE 3: VERIFICAÇÃO
-- ============================================================================

-- Ver se RLS foi desabilitado (deve mostrar false para todas)
SELECT
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Ver se usuário foi criado corretamente (auth_user_id NÃO pode ser NULL)
SELECT
  id,
  auth_user_id,
  user_id,
  company_id,
  name,
  email
FROM users
WHERE email = 'admin@vendai.com';

-- DEVE RETORNAR:
-- - rls_enabled = false para todas as tabelas
-- - auth_user_id com um UUID válido (não NULL)
