-- Permitir que admins atualizem dados de empresas
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

-- Permitir que admins leiam dados de empresas
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
