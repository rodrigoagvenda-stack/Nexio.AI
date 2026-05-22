-- Tabela de mensagens para suporte multi-turno
-- Execute no Supabase SQL Editor

CREATE TABLE IF NOT EXISTS support_ticket_messages (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   uuid        NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_type text        NOT NULL CHECK (sender_type IN ('user', 'support')),
  content     text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stm_ticket ON support_ticket_messages (ticket_id, created_at);

-- Migra mensagens antigas para a nova tabela (run once)
INSERT INTO support_ticket_messages (ticket_id, sender_type, content, created_at)
SELECT id, 'user', mensagem, created_at
FROM support_tickets
WHERE mensagem IS NOT NULL AND mensagem != ''
ON CONFLICT DO NOTHING;

INSERT INTO support_ticket_messages (ticket_id, sender_type, content, created_at)
SELECT id, 'support', resposta, respondido_em
FROM support_tickets
WHERE resposta IS NOT NULL AND resposta != '' AND respondido_em IS NOT NULL
ON CONFLICT DO NOTHING;
