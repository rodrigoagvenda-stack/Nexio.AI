-- Tabela de configurações globais do sistema (editável via admin panel)
-- Usada para rotação de chaves de API sem redeploy no EasyPanel

CREATE TABLE IF NOT EXISTS system_config (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Apenas service_role acessa (sem RLS pública)
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

-- Seed inicial (valores vazios — admin preenche via painel)
INSERT INTO system_config (key, value) VALUES
  ('GROQ_API_KEY', ''),
  ('OPENAI_API_KEY', '')
ON CONFLICT (key) DO NOTHING;
