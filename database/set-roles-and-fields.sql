-- ============================================================================
-- Configuração inicial para teste
-- Executar após multi-tenant-migration.sql
-- ============================================================================

-- 1. Setar company_admin para o dono de cada empresa (primeiro usuário criado)
UPDATE users
SET role = 'company_admin'
WHERE id IN (
  SELECT DISTINCT ON (company_id) id
  FROM users
  ORDER BY company_id, created_at ASC
);

-- 2. Setar whatsapp_instance_name nas empresas existentes
-- (usar o instanceName exato que aparece no webhook do UAZapi)
-- Exemplo: UPDATE companies SET whatsapp_instance_name = 'Nexio AI' WHERE id = 4;
-- Ajuste conforme os nomes das suas instâncias

-- 3. Ativar SDR para empresas que já estão em produção
-- UPDATE companies SET agente_ativo = true WHERE id IN (4);
-- Ajuste conforme necessário

-- 4. Verificar usuários sem role definido
SELECT id, name, email, company_id, role FROM users WHERE role IS NULL OR role = '';
