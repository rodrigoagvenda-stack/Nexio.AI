-- ============================================================================
-- FIX: Conectar usuário autenticado com a tabela users
-- ============================================================================
-- Este SQL resolve o problema de RLS e infinite recursion
-- Execute DEPOIS de criar o usuário no Supabase Auth
-- ============================================================================

-- STEP 1: Primeiro, veja qual é o UUID do usuário autenticado no Supabase
-- Vá em Authentication > Users no Supabase Dashboard
-- Copie o UUID do usuário admin@vendai.com

-- STEP 2: Atualizar/Inserir o usuário na tabela users
-- IMPORTANTE: Substitua 'SEU_UUID_AQUI' pelo UUID que você copiou

-- Deletar usuário antigo se existir
DELETE FROM users WHERE email = 'admin@vendai.com';

-- Inserir usuário corretamente linkado
INSERT INTO users (
  auth_user_id,  -- <-- Este campo PRECISA estar preenchido!
  user_id,
  company_id,
  name,
  email,
  is_active
) VALUES (
  'SEU_UUID_AQUI'::uuid,  -- <-- COLE O UUID DO SUPABASE AUTH AQUI
  gen_random_uuid(),      -- Gera um novo user_id
  (SELECT id FROM companies WHERE name = 'Empresa Teste - vend.AI' LIMIT 1),
  'Admin Teste',
  'admin@vendai.com',
  true
);

-- STEP 3: Verificar se funcionou
SELECT
  id,
  auth_user_id,
  user_id,
  company_id,
  name,
  email
FROM users
WHERE email = 'admin@vendai.com';

-- Deve retornar uma linha com auth_user_id preenchido (não NULL)
