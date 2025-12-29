-- ============================================================================
-- DIAGNÓSTICO: Verificar dados da tabela companies
-- Execute este SQL no Supabase para ver os dados das empresas
-- ============================================================================

-- 1. Ver todas as empresas cadastradas
SELECT
  id,
  name,
  email,
  phone,
  image_url,
  plan_type,
  vendagro_plan,
  is_active,
  created_at
FROM companies
ORDER BY created_at DESC;

-- 2. Ver quantos usuários estão linkados a cada empresa
SELECT
  c.id as company_id,
  c.name as company_name,
  c.email as company_email,
  COUNT(u.id) as total_users
FROM companies c
LEFT JOIN users u ON u.company_id = c.id
GROUP BY c.id, c.name, c.email
ORDER BY c.id;

-- 3. Ver usuários sem empresa (PROBLEMA!)
SELECT
  id,
  auth_user_id,
  user_id,
  name,
  email,
  company_id
FROM users
WHERE company_id IS NULL;

-- 4. Verificar se há empresas sem nome ou email (PROBLEMA para sidebar!)
SELECT
  id,
  name,
  email,
  phone,
  is_active
FROM companies
WHERE name IS NULL OR name = '' OR email IS NULL OR email = '';

-- ============================================================================
-- INTERPRETAÇÃO DOS RESULTADOS:
-- ============================================================================
--
-- QUERY 1: Lista todas as empresas
-- ✅ Deve ter pelo menos 1 empresa cadastrada
-- ⚠️ Verificar se name e email estão preenchidos
--
-- QUERY 2: Mostra quantos usuários por empresa
-- ✅ Cada empresa deve ter pelo menos 1 usuário
-- ❌ Se uma empresa tem 0 usuários = usuários não foram linkados corretamente
--
-- QUERY 3: Usuários sem empresa
-- ✅ Deve retornar vazio (0 linhas)
-- ❌ Se retornar alguma linha = PROBLEMA! Usuário não tem company_id
--     Solução: Rodar UPDATE users SET company_id = X WHERE id = Y
--
-- QUERY 4: Empresas sem nome/email
-- ✅ Deve retornar vazio (0 linhas)
-- ❌ Se retornar alguma linha = PROBLEMA! Sidebar não vai mostrar dados
--     Solução: Rodar UPDATE companies SET name = 'Nome', email = 'email' WHERE id = X
-- ============================================================================
