-- Adiciona coluna images para attachments de tickets
ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS images TEXT[] NOT NULL DEFAULT '{}';
