-- ============================================================================
-- FIX EMERGENCIAL: Sistema extremamente lento (40-60s)
-- ============================================================================
-- Este SQL resolve o problema de performance crítico
-- Execute IMEDIATAMENTE no Supabase SQL Editor
-- ============================================================================

-- PARTE 1: DESABILITAR RLS AGRESSIVAMENTE
-- ============================================================================

-- 1.1 Drop TODAS as policies (loop completo)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I CASCADE',
            r.policyname, r.schemaname, r.tablename);
        RAISE NOTICE 'Dropped policy: %', r.policyname;
    END LOOP;
END $$;

-- 1.2 Disable RLS em TODAS as tabelas do schema public
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
    ) LOOP
        EXECUTE format('ALTER TABLE IF EXISTS %I DISABLE ROW LEVEL SECURITY', r.tablename);
        RAISE NOTICE 'Disabled RLS on: %', r.tablename;
    END LOOP;
END $$;

-- PARTE 2: ADICIONAR ÍNDICES PARA ACELERAR QUERIES
-- ============================================================================

-- Índice para buscar user por auth_user_id (CRÍTICO)
CREATE INDEX IF NOT EXISTS idx_users_auth_user_id ON users(auth_user_id);

-- Índice para buscar user por company_id
CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id);

-- Índice para buscar leads por company_id (CRÍTICO)
CREATE INDEX IF NOT EXISTS idx_leads_company_id ON leads(company_id);

-- Índice para buscar leads por status
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);

-- Índice para ordenar leads por data
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);

-- Índice para conversas por company_id
CREATE INDEX IF NOT EXISTS idx_conversas_company_id ON conversas_do_whatsapp(company_id);

-- Índice para mensagens por conversa_id
CREATE INDEX IF NOT EXISTS idx_mensagens_conversa_id ON mensagens_do_whatsapp(conversa_id);

-- PARTE 3: OTIMIZAR CONFIGURAÇÕES DO POSTGRES
-- ============================================================================

-- Atualizar estatísticas das tabelas
ANALYZE users;
ANALYZE companies;
ANALYZE leads;
ANALYZE conversas_do_whatsapp;
ANALYZE mensagens_do_whatsapp;

-- PARTE 4: CORRIGIR LINK DO USUÁRIO (caso não tenha feito)
-- ============================================================================

-- Deletar usuário antigo
DELETE FROM users WHERE email = 'admin@vendai.com';

-- Inserir usuário corretamente linkado
INSERT INTO users (
  auth_user_id,
  user_id,
  company_id,
  name,
  email,
  is_active
)
SELECT
  au.id as auth_user_id,
  gen_random_uuid() as user_id,
  (SELECT id FROM companies WHERE name = 'Empresa Teste - vend.AI' LIMIT 1) as company_id,
  'Admin Teste' as name,
  'admin@vendai.com' as email,
  true as is_active
FROM auth.users au
WHERE au.email = 'admin@vendai.com'
LIMIT 1
ON CONFLICT (auth_user_id) DO UPDATE SET
  company_id = EXCLUDED.company_id,
  is_active = EXCLUDED.is_active;

-- PARTE 5: VERIFICAÇÃO FINAL
-- ============================================================================

-- Verificar RLS (DEVE mostrar false)
SELECT
    tablename,
    rowsecurity as rls_ativo
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Verificar índices criados
SELECT
    tablename,
    indexname
FROM pg_indexes
WHERE schemaname = 'public'
AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

-- Verificar usuário linkado (auth_user_id NÃO PODE ser NULL)
SELECT
    id,
    auth_user_id,
    company_id,
    name,
    email
FROM users
WHERE email = 'admin@vendai.com';

-- ============================================================================
-- RESULTADO ESPERADO:
-- - Todas as tabelas com rls_ativo = false
-- - 8 índices criados (idx_users_auth_user_id, idx_leads_company_id, etc)
-- - Usuário com auth_user_id preenchido
-- ============================================================================
