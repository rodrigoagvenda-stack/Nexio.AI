-- ================================================
-- CRIAR USUÁRIO ADMIN INICIAL
-- ================================================
-- Execute este script no SQL Editor do Supabase Dashboard
-- Depois faça login com: admin@igreja.com / Admin@123

-- 1. Criar igreja inicial
INSERT INTO igrejas (
  id,
  nome,
  tipo,
  endereco,
  cidade,
  estado,
  cep,
  telefone,
  email,
  nome_lider,
  ativo
) VALUES (
  'e0a3f3e2-8b5c-4d3e-9f2a-1a2b3c4d5e6f',
  'Igreja Pentecostal Vale da Bênção',
  'matriz',
  'Rua Principal, 123',
  'Sua Cidade',
  'BA',
  '00000-000',
  '(00) 00000-0000',
  'contato@igreja.com',
  'Pastor Principal',
  true
) ON CONFLICT (id) DO NOTHING;

-- 2. Criar perfil admin (vincular ao user auth depois)
-- IMPORTANTE: Após executar este script, você precisa:
-- 1. Ir em Authentication > Users no Supabase
-- 2. Criar um novo usuário com email: admin@igreja.com
-- 3. Copiar o UUID do usuário criado
-- 4. Executar o UPDATE abaixo substituindo 'SEU_USER_ID_AQUI' pelo UUID

-- Inserir profile placeholder (será atualizado depois)
INSERT INTO profiles (
  id,
  nome,
  email,
  role,
  igreja_id,
  ativo
) VALUES (
  '00000000-0000-0000-0000-000000000000', -- Placeholder, será substituído
  'Administrador',
  'admin@igreja.com',
  'admin',
  'e0a3f3e2-8b5c-4d3e-9f2a-1a2b3c4d5e6f',
  true
) ON CONFLICT (id) DO NOTHING;

-- ================================================
-- APÓS CRIAR O USUÁRIO NO SUPABASE AUTH, EXECUTE:
-- ================================================
-- UPDATE profiles
-- SET id = 'UUID_DO_USUARIO_CRIADO'
-- WHERE email = 'admin@igreja.com';
