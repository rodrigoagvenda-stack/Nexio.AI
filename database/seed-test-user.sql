-- Seed: Criar usuário de teste
-- Execute este SQL DEPOIS de rodar o complete-schema.sql

-- 1. Inserir empresa de teste
INSERT INTO companies (
  name,
  plan_type,
  whatsapp_instance_name,
  whatsapp_instance_token,
  google_maps_limit,
  icp_limit_per_month,
  has_vendagro,
  is_active,
  subscription_expires_at
) VALUES (
  'Empresa Teste - vend.AI',
  'performance',
  'vendai-test',
  'test-token-12345',
  500,
  200,
  true,
  true,
  (NOW() + INTERVAL '1 year')::DATE
)
ON CONFLICT DO NOTHING;

-- 2. Criar usuário no Supabase Auth (você precisa fazer isso manualmente no dashboard)
-- OU use este comando via Supabase API:
-- Email: admin@vendai.com
-- Password: vendai123

-- 3. Inserir usuário na tabela users
-- IMPORTANTE: Substitua 'USER_UUID_AQUI' pelo UUID que o Supabase gerou para o usuário
INSERT INTO users (
  user_id,
  company_id,
  name,
  email,
  role,
  department,
  is_active
) VALUES (
  'USER_UUID_AQUI', -- Copie o UUID do Supabase Auth
  (SELECT id FROM companies WHERE name = 'Empresa Teste - vend.AI' LIMIT 1),
  'Admin Teste',
  'admin@vendai.com',
  'admin',
  'TI',
  true
)
ON CONFLICT (user_id) DO NOTHING;

-- 4. Inserir alguns leads de exemplo
INSERT INTO leads (
  company_id,
  company_name,
  contact_name,
  email,
  phone,
  whatsapp,
  status,
  priority,
  temperature,
  source
) VALUES
(
  (SELECT id FROM companies WHERE name = 'Empresa Teste - vend.AI' LIMIT 1),
  'Agro Solutions LTDA',
  'João Silva',
  'joao@agrosolutions.com',
  '(11) 98765-4321',
  '5511987654321',
  'novo',
  'high',
  'hot',
  'google_maps'
),
(
  (SELECT id FROM companies WHERE name = 'Empresa Teste - vend.AI' LIMIT 1),
  'FarmTech Brasil',
  'Maria Santos',
  'maria@farmtech.com.br',
  '(19) 97654-3210',
  '5519976543210',
  'em_contato',
  'medium',
  'warm',
  'indicacao'
),
(
  (SELECT id FROM companies WHERE name = 'Empresa Teste - vend.AI' LIMIT 1),
  'Verde Campo Agro',
  'Pedro Oliveira',
  'pedro@verdecampo.com',
  '(16) 96543-2109',
  '5516965432109',
  'interessado',
  'high',
  'hot',
  'icp'
);
