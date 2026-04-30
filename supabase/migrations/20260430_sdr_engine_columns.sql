-- Garante colunas necessárias para o SDR Engine TypeScript

-- conversas_do_whatsapp
ALTER TABLE conversas_do_whatsapp ADD COLUMN IF NOT EXISTS instance_name text;
ALTER TABLE conversas_do_whatsapp ADD COLUMN IF NOT EXISTS agente_pausado boolean DEFAULT false;
ALTER TABLE conversas_do_whatsapp ADD COLUMN IF NOT EXISTS assigned_to bigint REFERENCES users(user_id);

CREATE INDEX IF NOT EXISTS idx_conversas_instance_name ON conversas_do_whatsapp(company_id, instance_name);

-- mensagens_do_whatsapp
ALTER TABLE mensagens_do_whatsapp ADD COLUMN IF NOT EXISTS company_id bigint REFERENCES companies(id);
ALTER TABLE mensagens_do_whatsapp ADD COLUMN IF NOT EXISTS carimbo_de_data_e_hora timestamptz DEFAULT now();
ALTER TABLE mensagens_do_whatsapp ADD COLUMN IF NOT EXISTS url_da_midia text;
ALTER TABLE mensagens_do_whatsapp ADD COLUMN IF NOT EXISTS nome_do_agente text;
ALTER TABLE mensagens_do_whatsapp ADD COLUMN IF NOT EXISTS is_edited boolean DEFAULT false;
ALTER TABLE mensagens_do_whatsapp ADD COLUMN IF NOT EXISTS is_pinned boolean DEFAULT false;
ALTER TABLE mensagens_do_whatsapp ADD COLUMN IF NOT EXISTS whatsapp_message_id text;

-- Índice para busca por conversa + timestamp (fetchMessages usa carimbo_de_data_e_hora)
CREATE INDEX IF NOT EXISTS idx_mensagens_conversa_ts
  ON mensagens_do_whatsapp(id_da_conversacao, carimbo_de_data_e_hora DESC);

CREATE INDEX IF NOT EXISTS idx_mensagens_company
  ON mensagens_do_whatsapp(company_id, carimbo_de_data_e_hora DESC);
