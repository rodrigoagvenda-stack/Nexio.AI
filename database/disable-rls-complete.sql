-- ============================================================================
-- DESABILITAR COMPLETAMENTE ROW LEVEL SECURITY
-- Execute este SQL no Supabase para remover TODAS as políticas RLS
-- ============================================================================

-- STEP 1: DROP todas as policies existentes
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

-- STEP 2: DISABLE RLS em TODAS as tabelas
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

-- STEP 3: Verificar status (deve retornar vazio se tudo foi removido)
SELECT
    schemaname,
    tablename,
    policyname,
    cmd
FROM pg_policies
WHERE schemaname = 'public';

-- STEP 4: Verificar RLS status das tabelas (deve mostrar relrowsecurity = false)
SELECT
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
