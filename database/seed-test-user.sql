-- Seed: Criar usuário de teste
-- Execute este SQL DEPOIS de rodar o complete-schema.sql

-- 1. Inserir empresa de teste
INSERT INTO companies (
  name,
  email,
  plan_type,
  vendagro_plan,
  plan_monthly_limit,
  whatsapp_instance,
  whatsapp_token,
  is_active,
  subscription_expires_at
) VALUES (
  'Empresa Teste - vend.AI',
  'empresa@vendai.com',
  'performance',
  'advanced',
  500,
  'vendai-test',
  'test-token-12345',
  true,
  (NOW() + INTERVAL '1 year')
)
ON CONFLICT (email) DO NOTHING;

-- 2. Criar usuário no Supabase Auth (você precisa fazer isso manualmente no dashboard)
-- OU use este comando via Supabase API:
-- Email: admin@vendai.com
-- Password: vendai123

-- 3. Inserir usuário na tabela users
-- AUTOMATICAMENTE busca o UUID do auth.users
INSERT INTO users (
  auth_user_id,
  user_id,
  company_id,
  name,
  email,
  department,
  is_active
)
SELECT
  au.id as auth_user_id,
  gen_random_uuid() as user_id,
  (SELECT id FROM companies WHERE name = 'Empresa Teste - vend.AI' LIMIT 1) as company_id,
  'Admin Teste' as name,
  'admin@vendai.com' as email,
  'TI' as department,
  true as is_active
FROM auth.users au
WHERE au.email = 'admin@vendai.com'
LIMIT 1
ON CONFLICT (auth_user_id) DO NOTHING;

-- 4. Inserir alguns leads de exemplo
INSERT INTO leads (
  company_id,
  company_name,
  contact_name,
  email,
  whatsapp,
  status,
  priority,
  nivel_interesse,
  import_source,
  segment
) VALUES
(
  (SELECT id FROM companies WHERE name = 'Empresa Teste - vend.AI' LIMIT 1),
  'Agro Solutions LTDA',
  'João Silva',
  'joao@agrosolutions.com',
  '5511987654321',
  'Lead novo',
  'Alta',
  'Quente 🔥',
  'Google Maps',
  'Agricultura'
),
(
  (SELECT id FROM companies WHERE name = 'Empresa Teste - vend.AI' LIMIT 1),
  'FarmTech Brasil',
  'Maria Santos',
  'maria@farmtech.com.br',
  '5519976543210',
  'Em contato',
  'Média',
  'Morno 🌡️',
  'Google Maps',
  'Tecnologia Agrícola'
),
(
  (SELECT id FROM companies WHERE name = 'Empresa Teste - vend.AI' LIMIT 1),
  'Verde Campo Agro',
  'Pedro Oliveira',
  'pedro@verdecampo.com',
  '5516965432109',
  'Interessado',
  'Alta',
  'Quente 🔥',
  'PEG',
  'Agronegócio'
);
