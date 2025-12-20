-- ============================================================================
-- DIAGNÓSTICO: Verificar por que o CRM não carrega
-- ============================================================================
-- Execute este SQL no Supabase para ver onde está o problema
-- ============================================================================

-- 1. Verificar se RLS está desabilitado (DEVE mostrar false)
SELECT
    tablename,
    rowsecurity as rls_ativo
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('users', 'leads', 'companies')
ORDER BY tablename;

-- 2. Verificar usuário na tabela auth.users
SELECT
    id as auth_user_id,
    email,
    created_at
FROM auth.users
WHERE email = 'admin@vendai.com';

-- 3. Verificar usuário na tabela users (CRÍTICO)
SELECT
    id,
    auth_user_id,
    user_id,
    company_id,
    name,
    email,
    is_active
FROM users
WHERE email = 'admin@vendai.com';

-- 4. Verificar empresa
SELECT
    id,
    name,
    email,
    plan_type,
    is_active
FROM companies
WHERE name = 'Empresa Teste - vend.AI';

-- 5. Verificar leads (devem existir 3)
SELECT
    id,
    company_id,
    company_name,
    contact_name,
    status,
    priority,
    nivel_interesse
FROM leads
ORDER BY created_at DESC
LIMIT 10;

-- ============================================================================
-- INTERPRETAÇÃO DOS RESULTADOS:
-- ============================================================================
--
-- TABELA 1 (RLS):
-- ✅ Se rls_ativo = false → OK
-- ❌ Se rls_ativo = true → PROBLEMA! Rode fix-complete.sql
--
-- TABELA 2 (Auth):
-- ✅ Deve retornar 1 linha com o UUID
-- ❌ Se vazio → Criar usuário no Supabase Dashboard primeiro
--
-- TABELA 3 (Users):
-- ✅ auth_user_id deve estar PREENCHIDO (não NULL)
-- ✅ company_id deve estar PREENCHIDO
-- ❌ Se auth_user_id = NULL → PROBLEMA! Rode fix-complete.sql
-- ❌ Se vazio → PROBLEMA! Rode fix-complete.sql
--
-- TABELA 4 (Companies):
-- ✅ Deve retornar 1 linha
-- ❌ Se vazio → Rode seed-test-user.sql
--
-- TABELA 5 (Leads):
-- ✅ Deve retornar 3 leads
-- ❌ Se vazio → Normal, pode adicionar leads manualmente no CRM
--
-- ============================================================================
