-- Controle admin por empresa: habilitar/desabilitar API não oficial (uazapi)
-- Por padrão TRUE para não quebrar empresas existentes
ALTER TABLE companies ADD COLUMN IF NOT EXISTS allow_uazapi BOOLEAN DEFAULT TRUE NOT NULL;
