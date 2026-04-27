-- Migration 05: foto_url e contexto em conversas_whatsapp
ALTER TABLE conversas_whatsapp
  ADD COLUMN IF NOT EXISTS contexto JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS foto_url TEXT;
