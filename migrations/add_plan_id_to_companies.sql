-- Adicionar coluna plan_id à tabela companies
ALTER TABLE companies ADD COLUMN IF NOT EXISTS plan_id INTEGER REFERENCES plans(id);

-- Criar índice para melhorar performance
CREATE INDEX IF NOT EXISTS idx_companies_plan_id ON companies(plan_id);

-- Migrar dados existentes: mapear vendagro_plan para plan_id
-- 'performance' -> Agro Inteligente (id: 1)
-- 'advanced' -> Agro Predict (id: 2)
UPDATE companies
SET plan_id = 1
WHERE vendagro_plan = 'performance' AND plan_id IS NULL;

UPDATE companies
SET plan_id = 2
WHERE vendagro_plan = 'advanced' AND plan_id IS NULL;
