-- Adiciona colunas que podem estar ausentes na system_logs existente
ALTER TABLE system_logs ADD COLUMN IF NOT EXISTS payload     JSONB;
ALTER TABLE system_logs ADD COLUMN IF NOT EXISTS stack_trace TEXT;
ALTER TABLE system_logs ADD COLUMN IF NOT EXISTS user_id     UUID;
ALTER TABLE system_logs ADD COLUMN IF NOT EXISTS severity    TEXT NOT NULL DEFAULT 'info';
ALTER TABLE system_logs ADD COLUMN IF NOT EXISTS type        TEXT NOT NULL DEFAULT 'system';
