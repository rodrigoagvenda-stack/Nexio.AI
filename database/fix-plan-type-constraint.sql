-- ============================================================================
-- FIX: Corrigir constraint companies_plan_type_check
-- Execute no Supabase SQL Editor
-- ============================================================================

-- PASSO 1: Corrigir empresas com plan_type 'premium' → 'performance' (NEXIO GROWTH)
UPDATE companies SET plan_type = 'performance', plan_name = 'NEXIO GROWTH' WHERE plan_type = 'premium';

-- PASSO 2: Recriar a constraint com valores corretos
ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_plan_type_check;
ALTER TABLE companies ADD CONSTRAINT companies_plan_type_check CHECK (plan_type IN ('basic', 'performance', 'advanced'));

-- PASSO 3: Verificar
SELECT id, name, plan_type, plan_name FROM companies;
