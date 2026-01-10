-- =============================================
-- DESABILITAR RLS - VERSÃO CORRIGIDA
-- Execute no SQL Editor do Supabase
-- =============================================

-- PASSO 1: Remover TODAS as policies
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
        RAISE NOTICE 'Policy removida: % na tabela %', r.policyname, r.tablename;
    END LOOP;
END $$;

-- PASSO 2: Remover funções helper
DROP FUNCTION IF EXISTS is_admin() CASCADE;
DROP FUNCTION IF EXISTS pertence_igreja(UUID) CASCADE;
DROP FUNCTION IF EXISTS tem_permissao_financeira() CASCADE;
DROP FUNCTION IF EXISTS tem_permissao_escrita() CASCADE;

-- PASSO 3: Desabilitar RLS em todas as tabelas que existem
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE igrejas DISABLE ROW LEVEL SECURITY;
ALTER TABLE membros DISABLE ROW LEVEL SECURITY;
ALTER TABLE membros_funcoes DISABLE ROW LEVEL SECURITY;
ALTER TABLE ministerios DISABLE ROW LEVEL SECURITY;
ALTER TABLE ministerios_membros DISABLE ROW LEVEL SECURITY;
ALTER TABLE escalas DISABLE ROW LEVEL SECURITY;
ALTER TABLE escalas_detalhes DISABLE ROW LEVEL SECURITY;
ALTER TABLE cultos_regulares DISABLE ROW LEVEL SECURITY;
ALTER TABLE categorias_financeiras DISABLE ROW LEVEL SECURITY;
ALTER TABLE contas_bancarias DISABLE ROW LEVEL SECURITY;
ALTER TABLE lancamentos_financeiros DISABLE ROW LEVEL SECURITY;
ALTER TABLE despesas_recorrentes DISABLE ROW LEVEL SECURITY;
ALTER TABLE orcamento DISABLE ROW LEVEL SECURITY;
ALTER TABLE eventos DISABLE ROW LEVEL SECURITY;
ALTER TABLE eventos_inscricoes DISABLE ROW LEVEL SECURITY;
ALTER TABLE frequencias DISABLE ROW LEVEL SECURITY;
ALTER TABLE mensagens DISABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos_oracao DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY;

-- Mensagem final
DO $$
BEGIN
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'RLS DESABILITADO EM TODAS AS TABELAS!';
  RAISE NOTICE 'Tente fazer login agora!';
  RAISE NOTICE '==============================================';
END $$;
