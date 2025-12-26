-- Adicionar campos de leitura às notificações
ALTER TABLE activity_logs
ADD COLUMN IF NOT EXISTS read BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS read_at TIMESTAMP WITH TIME ZONE;

-- Índice para buscar notificações não lidas
CREATE INDEX IF NOT EXISTS idx_activity_logs_read ON activity_logs(read);

-- Comentário
COMMENT ON COLUMN activity_logs.read IS 'Se a notificação foi lida pelo usuário';
COMMENT ON COLUMN activity_logs.read_at IS 'Timestamp de quando a notificação foi lida';
