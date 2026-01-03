-- =====================================================
-- FASE 4: Agendamento + Mídia
-- =====================================================
-- Adiciona funcionalidades de agendamento de mensagens e gestão de mídia

-- 1. Criar tabela de mensagens agendadas
CREATE TABLE IF NOT EXISTS scheduled_messages (
  id SERIAL PRIMARY KEY,
  chat_id INTEGER REFERENCES conversas_do_whatsapp(id) ON DELETE CASCADE,
  lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  type TEXT DEFAULT 'text',
  media_url TEXT,
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'pending',
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  CONSTRAINT valid_status CHECK (status IN ('pending', 'sent', 'cancelled', 'failed'))
);

-- 2. Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_company
  ON scheduled_messages(company_id);

CREATE INDEX IF NOT EXISTS idx_scheduled_messages_status
  ON scheduled_messages(status)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_scheduled_messages_scheduled_for
  ON scheduled_messages(scheduled_for)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_scheduled_messages_chat
  ON scheduled_messages(chat_id);

CREATE INDEX IF NOT EXISTS idx_scheduled_messages_lead
  ON scheduled_messages(lead_id);

-- 3. RLS (Row Level Security)
ALTER TABLE scheduled_messages ENABLE ROW LEVEL SECURITY;

-- Política: Usuários só veem agendamentos da própria empresa
CREATE POLICY scheduled_messages_company_isolation
  ON scheduled_messages
  FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

-- 4. Comentários para documentação
COMMENT ON TABLE scheduled_messages IS 'Mensagens agendadas para envio futuro';
COMMENT ON COLUMN scheduled_messages.status IS 'Status: pending, sent, cancelled, failed';
COMMENT ON COLUMN scheduled_messages.scheduled_for IS 'Data/hora agendada para envio';
COMMENT ON COLUMN scheduled_messages.type IS 'Tipo: text, image, audio, video, document';
