-- Adiciona instance_name para isolar conversas por instância WhatsApp
ALTER TABLE conversas_do_whatsapp ADD COLUMN IF NOT EXISTS instance_name text;
CREATE INDEX IF NOT EXISTS idx_conversas_instance_name ON conversas_do_whatsapp(company_id, instance_name);
