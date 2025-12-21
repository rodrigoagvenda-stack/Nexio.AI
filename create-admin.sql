-- ============================================================================
-- Script para criar conta de Administrador
-- ============================================================================
-- Execute este script no Supabase SQL Editor

-- PASSO 1: Criar usuário no Supabase Auth
-- Substitua 'SUA_SENHA_AQUI' por uma senha forte
-- Este passo cria o usuário de autenticação

DO $$
DECLARE
  new_user_id UUID;
BEGIN
  -- Inserir usuário no auth.users
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    recovery_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'admin@vendai.com.br',
    crypt('Admin123!', gen_salt('bf')), -- Senha: Admin123!
    NOW(),
    NOW(),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    NOW(),
    NOW(),
    '',
    '',
    '',
    ''
  )
  RETURNING id INTO new_user_id;

  -- Inserir identidade do usuário
  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    new_user_id,
    format('{"sub":"%s","email":"%s"}', new_user_id, 'admin@vendai.com.br')::jsonb,
    'email',
    NOW(),
    NOW(),
    NOW()
  );

  -- PASSO 2: Criar entrada na tabela admin_users
  INSERT INTO admin_users (
    auth_user_id,
    name,
    email,
    role,
    is_active
  ) VALUES (
    new_user_id,
    'Administrador Principal',
    'admin@vendai.com.br',
    'super_admin',
    true
  );

  RAISE NOTICE 'Admin criado com sucesso! Email: admin@vendai.com.br | Senha: Admin123!';
END $$;
