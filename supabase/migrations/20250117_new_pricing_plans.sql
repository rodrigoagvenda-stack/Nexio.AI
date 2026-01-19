ALTER TABLE companies ADD COLUMN IF NOT EXISTS plan_name TEXT;

UPDATE companies SET plan_name =
  CASE
    WHEN plan_type = 'basic' THEN 'NEXIO SALES'
    WHEN plan_type = 'performance' THEN 'NEXIO GROWTH'
    WHEN plan_type = 'advanced' THEN 'NEXIO ADS'
    ELSE 'NEXIO SALES'
  END
WHERE plan_name IS NULL;

ALTER TABLE companies ADD COLUMN IF NOT EXISTS plan_price DECIMAL(10,2);

UPDATE companies SET plan_price =
  CASE
    WHEN plan_type = 'basic' THEN 1600.00
    WHEN plan_type = 'performance' THEN 2000.00
    WHEN plan_type = 'advanced' THEN 2600.00
    ELSE 1600.00
  END
WHERE plan_price IS NULL;

ALTER TABLE companies ADD COLUMN IF NOT EXISTS plan_features JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN companies.plan_name IS 'Nome do plano: NEXIO SALES, NEXIO GROWTH, NEXIO ADS';
COMMENT ON COLUMN companies.plan_price IS 'Preço mensal do plano em reais';
COMMENT ON COLUMN companies.plan_features IS 'Array JSON com features incluídas no plano';
