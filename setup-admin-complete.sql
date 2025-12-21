-- ============================================================================
-- SETUP COMPLETO: Cria tabela admin_users + usuário admin
-- ============================================================================
-- Execute este SQL no Supabase SQL Editor

-- PASSO 1: Criar tabela admin_users (se não existir)
CREATE TABLE IF NOT EXISTS admin_users (
  id SERIAL PRIMARY KEY,
  auth_user_id UUID UNIQUE REFERENCES auth.users(id),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT DEFAULT 'admin', -- 'super_admin', 'admin', 'support'
  is_active BOOLEAN DEFAULT TRUE,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- PASSO 2: Adicionar índices para performance
CREATE INDEX IF NOT EXISTS idx_admin_users_auth_user_id ON admin_users(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_users_is_active ON admin_users(is_active);

-- PASSO 3: Verificar se já existe um usuário admin com esse email
DO $$
DECLARE
  existing_admin_id UUID;
  admin_email TEXT := 'admin@vendai.com.br';
BEGIN
  -- Verificar se o usuário já existe no auth.users
  SELECT id INTO existing_admin_id
  FROM auth.users
  WHERE email = admin_email
  LIMIT 1;

  IF existing_admin_id IS NOT NULL THEN
    -- Usuário já existe, apenas adiciona na tabela admin_users
    INSERT INTO admin_users (
      auth_user_id,
      name,
      email,
      role,
      is_active
    ) VALUES (
      existing_admin_id,
      'Administrador Principal',
      admin_email,
      'super_admin',
      true
    )
    ON CONFLICT (auth_user_id) DO UPDATE
    SET
      role = 'super_admin',
      is_active = true,
      name = 'Administrador Principal';

    RAISE NOTICE 'Usuário existente transformado em admin!';
  ELSE
    RAISE NOTICE 'Usuário não encontrado. Por favor, crie o usuário primeiro no painel do Supabase.';
    RAISE NOTICE 'Vá em Authentication > Users > Add user';
    RAISE NOTICE 'Email: admin@vendai.com.br';
    RAISE NOTICE 'Senha: Admin123!';
    RAISE NOTICE 'Marque: Auto Confirm User';
  END IF;
END $$;
