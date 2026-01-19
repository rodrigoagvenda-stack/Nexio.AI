-- Atualizar TODAS as empresas para ter plan_name baseado no plan_type
UPDATE companies
SET plan_name = CASE
  WHEN plan_type = 'basic' THEN 'NEXIO SALES'
  WHEN plan_type = 'performance' THEN 'NEXIO GROWTH'
  WHEN plan_type = 'premium' THEN 'NEXIO GROWTH'
  WHEN plan_type = 'advanced' THEN 'NEXIO ADS'
  ELSE 'NEXIO SALES'
END;

-- Verificar
SELECT id, name, plan_type, plan_name FROM companies;
