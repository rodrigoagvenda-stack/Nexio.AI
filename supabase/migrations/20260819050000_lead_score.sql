-- Peça E do plano "máquina de vendas completa": lead score em tempo real.
-- mensagens_recebidas é o contador de profundidade (barato, incrementado
-- inline em cada inbound, sem contar a tabela de mensagens do zero).
ALTER TABLE conversas_do_whatsapp
  ADD COLUMN IF NOT EXISTS mensagens_recebidas INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lead_score INT,
  ADD COLUMN IF NOT EXISTS lead_score_updated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_conversas_lead_score
  ON conversas_do_whatsapp (company_id, lead_score DESC, hora_da_ultima_mensagem DESC);
