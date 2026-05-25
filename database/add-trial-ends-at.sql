-- Adiciona coluna trial_ends_at na tabela companies
-- Trial de 7 dias: sem SDR, sem Canvas, sem Automações

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ DEFAULT NULL;

-- Empresas já existentes com plan_type = 'trial' que não têm data: define 7 dias a partir de hoje
UPDATE companies
SET trial_ends_at = NOW() + INTERVAL '7 days'
WHERE plan_type = 'trial' AND trial_ends_at IS NULL;
