-- Script para aplicar a migração de planos no Supabase
-- Execute este script no SQL Editor do Supabase Dashboard

-- 1. Adicionar coluna plan_name se não existir
ALTER TABLE companies ADD COLUMN IF NOT EXISTS plan_name TEXT;

-- 2. Mapear os planos antigos para os novos nomes
UPDATE companies SET plan_name =
  CASE
    WHEN plan_type = 'basic' THEN 'NEXIO SALES'
    WHEN plan_type = 'performance' THEN 'NEXIO GROWTH'
    WHEN plan_type = 'advanced' THEN 'NEXIO ADS'
    ELSE 'NEXIO SALES'
  END
WHERE plan_name IS NULL OR plan_name = '';

-- 3. Adicionar coluna plan_price se não existir
ALTER TABLE companies ADD COLUMN IF NOT EXISTS plan_price DECIMAL(10,2);

-- 4. Definir os preços de acordo com os planos
UPDATE companies SET plan_price =
  CASE
    WHEN plan_name = 'NEXIO SALES' THEN 1600.00
    WHEN plan_name = 'NEXIO GROWTH' THEN 2000.00
    WHEN plan_name = 'NEXIO ADS' THEN 2600.00
    ELSE 1600.00
  END
WHERE plan_price IS NULL;

-- 5. Adicionar coluna plan_features se não existir
ALTER TABLE companies ADD COLUMN IF NOT EXISTS plan_features JSONB DEFAULT '[]'::jsonb;

-- 6. Adicionar comentários nas colunas
COMMENT ON COLUMN companies.plan_name IS 'Nome do plano: NEXIO SALES, NEXIO GROWTH, NEXIO ADS';
COMMENT ON COLUMN companies.plan_price IS 'Preço mensal do plano em reais';
COMMENT ON COLUMN companies.plan_features IS 'Array JSON com features incluídas no plano';

-- 7. Verificar os resultados
SELECT id, name, plan_type, plan_name, plan_price
FROM companies
ORDER BY id;
