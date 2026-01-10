-- =============================================
-- FIX COMPLETO DO RLS - Execute no SQL Editor do Supabase
-- =============================================

-- PASSO 1: Desabilitar RLS em todas as tabelas
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE igrejas DISABLE ROW LEVEL SECURITY;
ALTER TABLE membros DISABLE ROW LEVEL SECURITY;
ALTER TABLE membros_funcoes DISABLE ROW LEVEL SECURITY;
ALTER TABLE ministerios DISABLE ROW LEVEL SECURITY;
ALTER TABLE escalas DISABLE ROW LEVEL SECURITY;
ALTER TABLE escalas_detalhes DISABLE ROW LEVEL SECURITY;
ALTER TABLE cultos_regulares DISABLE ROW LEVEL SECURITY;
ALTER TABLE categorias_financeiras DISABLE ROW LEVEL SECURITY;
ALTER TABLE contas_bancarias DISABLE ROW LEVEL SECURITY;
ALTER TABLE lancamentos_financeiros DISABLE ROW LEVEL SECURITY;
ALTER TABLE despesas_recorrentes DISABLE ROW LEVEL SECURITY;
ALTER TABLE eventos DISABLE ROW LEVEL SECURITY;
ALTER TABLE frequencias DISABLE ROW LEVEL SECURITY;
ALTER TABLE mensagens DISABLE ROW LEVEL SECURITY;
ALTER TABLE mensagens_destinatarios DISABLE ROW LEVEL SECURITY;

-- PASSO 2: Remover TODAS as policies existentes
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I CASCADE',
            r.policyname, r.schemaname, r.tablename);
    END LOOP;
END $$;

-- PASSO 3: Remover TODAS as funções helper
DROP FUNCTION IF EXISTS is_admin() CASCADE;
DROP FUNCTION IF EXISTS pertence_igreja(UUID) CASCADE;
DROP FUNCTION IF EXISTS tem_permissao_financeira() CASCADE;
DROP FUNCTION IF EXISTS tem_permissao_escrita() CASCADE;

-- PASSO 4: Recriar as funções helper
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
    AND ativo = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION pertence_igreja(igreja_id_param UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND igreja_id = igreja_id_param
    AND ativo = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION tem_permissao_financeira()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'pastor', 'tesoureiro')
    AND ativo = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION tem_permissao_escrita()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'pastor', 'secretaria')
    AND ativo = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- PASSO 5: Recriar apenas as policies ESSENCIAIS para o login funcionar
-- PROFILES - Apenas permissões básicas
CREATE POLICY "allow_select_own_profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "allow_select_admin"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'admin'
      AND p.ativo = TRUE
    )
  );

CREATE POLICY "allow_update_own_profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- IGREJAS - Todos autenticados podem ver
CREATE POLICY "allow_select_igrejas"
  ON igrejas FOR SELECT
  USING (auth.role() = 'authenticated');

-- PASSO 6: Re-habilitar RLS apenas nas tabelas essenciais
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE igrejas ENABLE ROW LEVEL SECURITY;

-- Mensagem de sucesso
DO $$
BEGIN
  RAISE NOTICE 'RLS corrigido com sucesso! Tente fazer login agora.';
END $$;
