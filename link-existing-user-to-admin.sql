-- ============================================================================
-- Script para transformar usuário existente em Admin
-- ============================================================================
-- Substitua 'SEU_EMAIL@AQUI.COM' pelo email do usuário que você quer tornar admin

INSERT INTO admin_users (
  auth_user_id,
  name,
  email,
  role,
  is_active
)
SELECT
  au.id,
  'Administrador Principal',
  au.email,
  'super_admin',
  true
FROM auth.users au
WHERE au.email = 'SEU_EMAIL@AQUI.COM' -- << SUBSTITUA AQUI
  AND NOT EXISTS (
    SELECT 1 FROM admin_users
    WHERE auth_user_id = au.id
  );
