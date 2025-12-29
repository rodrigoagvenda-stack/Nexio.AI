-- Remover policies antigas se existirem
DROP POLICY IF EXISTS "Admins can update companies" ON companies;
DROP POLICY IF EXISTS "Admins can read companies" ON companies;

-- Habilitar RLS
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- Permitir que admins leiam empresas
CREATE POLICY "Admins can read companies"
ON companies
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.user_id = auth.uid()
    AND admin_users.is_active = true
  )
);

-- Permitir que admins atualizem empresas
CREATE POLICY "Admins can update companies"
ON companies
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.user_id = auth.uid()
    AND admin_users.is_active = true
  )
);

-- Permitir que service_role faça tudo (bypass RLS)
CREATE POLICY "Service role has full access"
ON companies
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
