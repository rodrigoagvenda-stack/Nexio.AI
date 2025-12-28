-- Adicionar campos para configuração de MQLs nos planos
ALTER TABLE plans ADD COLUMN IF NOT EXISTS mql_percentage INTEGER DEFAULT 70;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS description TEXT;

-- Atualizar planos existentes
UPDATE plans SET
  name = 'Agro Inteligente',
  extraction_limit = 70,
  mql_percentage = 70,
  description = 'Receba 70 leads por mês, sendo 70% MQLs (49 MQLs + 21 leads normais)'
WHERE id = 1;

UPDATE plans SET
  name = 'Agro Predict',
  extraction_limit = 115,
  mql_percentage = 70,
  description = 'Receba até 115 leads por mês, sendo 70% MQLs (80 MQLs + 35 leads normais)'
WHERE id = 2;

-- Inserir se não existirem
INSERT INTO plans (id, name, extraction_limit, mql_percentage, description)
VALUES
  (1, 'Agro Inteligente', 70, 70, 'Receba 70 leads por mês, sendo 70% MQLs (49 MQLs + 21 leads normais)'),
  (2, 'Agro Predict', 115, 70, 'Receba até 115 leads por mês, sendo 70% MQLs (80 MQLs + 35 leads normais)')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  extraction_limit = EXCLUDED.extraction_limit,
  mql_percentage = EXCLUDED.mql_percentage,
  description = EXCLUDED.description;
