-- Adicionar colunas de atribuição na tabela conversas_do_whatsapp
ALTER TABLE conversas_do_whatsapp
ADD COLUMN IF NOT EXISTS assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- Criar índices para melhorar performance
CREATE INDEX IF NOT EXISTS idx_conversas_assigned_to ON conversas_do_whatsapp(assigned_to);
CREATE INDEX IF NOT EXISTS idx_conversas_company_assigned ON conversas_do_whatsapp(company_id, assigned_to);

-- Adicionar comentários
COMMENT ON COLUMN conversas_do_whatsapp.assigned_to IS 'ID do usuário para quem o chat está atribuído';
COMMENT ON COLUMN conversas_do_whatsapp.assigned_at IS 'Data e hora em que o chat foi atribuído';
COMMENT ON COLUMN conversas_do_whatsapp.assigned_by IS 'ID do usuário que fez a atribuição';
